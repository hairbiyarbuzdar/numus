const express = require("express");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");
const { emitNotification } = require("../socket");

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToProduct(row) {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    title: row.title,
    description: row.description,
    category: row.category,
    images: row.images || [],
    productType: row.product_type,

    // Retail / Wholesale
    basePrice: row.base_price ? parseFloat(row.base_price) : undefined,
    stock: row.stock,
    minOrderQty: row.min_order_qty,
    bulkTiers: row.bulk_tiers || undefined,

    // Auction
    isAuction: row.is_auction,
    startingPrice: row.starting_price ? parseFloat(row.starting_price) : undefined,
    currentHighestBid: row.current_highest_bid ? parseFloat(row.current_highest_bid) : undefined,
    bidIncrement: row.bid_increment ? parseFloat(row.bid_increment) : undefined,
    auctionStartTime: row.auction_start_time ? parseInt(row.auction_start_time) : undefined,
    auctionEndTime: row.auction_end_time ? parseInt(row.auction_end_time) : undefined,
    buyNowPrice: row.buy_now_price ? parseFloat(row.buy_now_price) : undefined,
    auctionQuantity: row.auction_quantity,
    auctionStatus: row.auction_status || undefined,
    winnerBidderId: row.winner_bidder_id || undefined,
    winnerBidderName: row.winner_bidder_name || undefined,
    winnerOrderId: row.winner_order_id || undefined,

    // Status
    isActive: row.is_active,
    approvalStatus: row.approval_status,
    isApproved: row.approval_status === "approved",
    submittedAt: row.submitted_at ? parseInt(row.submitted_at) : undefined,
    approvedAt: row.approved_at ? parseInt(row.approved_at) : undefined,
    approvedBy: row.approved_by || undefined,
    rejectionReason: row.rejection_reason || undefined,
    rejectedAt: row.rejected_at ? parseInt(row.rejected_at) : undefined,

    rating: row.rating ? parseFloat(row.rating) : 0,
    reviewsCount: row.reviews_count || 0,
    createdAt: row.created_at ? parseInt(row.created_at) : undefined,
    updatedAt: row.updated_at ? parseInt(row.updated_at) : undefined,

    bids: row.bids || [],
  };
}

async function getBidsForProduct(productId) {
  const { rows } = await pool.query(
    `SELECT id, bidder_id, bidder_name, amount, created_at
     FROM bids WHERE product_id = $1 ORDER BY created_at ASC`,
    [productId]
  );
  return rows.map((b) => ({
    id: b.id,
    bidderId: b.bidder_id,
    bidderName: b.bidder_name,
    amount: parseFloat(b.amount),
    timestamp: parseInt(b.created_at),
  }));
}

// ─── GET /products ─────────────────────────────────────────────────────────────
// Query params: vendorId, approvalStatus, productType, isActive
router.get("/", async (req, res) => {
  try {
    const conditions = [];
    const values = [];
    let i = 1;

    const { vendorId, approvalStatus, productType, isActive } = req.query;

    // Vendors see only their own products; buyers/admin see all
    const actorRole = req.actor.role;
    const actorId = req.actor.userId;

    if (actorRole === "vendor") {
      conditions.push(`p.vendor_id = $${i++}`);
      values.push(actorId);
    } else if (vendorId) {
      conditions.push(`p.vendor_id = $${i++}`);
      values.push(vendorId);
    }

    if (approvalStatus) {
      conditions.push(`p.approval_status = $${i++}`);
      values.push(approvalStatus);
    }

    if (productType) {
      conditions.push(`p.product_type = $${i++}`);
      values.push(productType);
    }

    if (isActive !== undefined) {
      conditions.push(`p.is_active = $${i++}`);
      values.push(isActive === "true");
    }

    // Buyers only see approved + active products
    if (actorRole === "buyer") {
      conditions.push(`p.approval_status = 'approved'`);
      conditions.push(`p.is_active = TRUE`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT p.* FROM products p ${where} ORDER BY p.created_at DESC`,
      values
    );

    // Fetch bids for auction products
    const products = await Promise.all(
      rows.map(async (row) => {
        const product = rowToProduct(row);
        if (row.is_auction) {
          product.bids = await getBidsForProduct(row.id);
        }
        return product;
      })
    );

    res.json(products);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /products/close-expired-auctions ─────────────────────────────────────
router.post("/close-expired-auctions", async (req, res) => {
  try {
    const now = Date.now();
    const { rows } = await pool.query(
      `SELECT * FROM products
       WHERE is_auction = TRUE AND auction_status = 'live' AND auction_end_time <= $1`,
      [now]
    );

    const results = [];
    for (const row of rows) {
      const bids = await getBidsForProduct(row.id);
      const topBid = bids.sort((a, b) => b.amount - a.amount)[0];

      const winner = topBid ? topBid.bidderId : null;
      const winnerName = topBid ? topBid.bidderName : null;

      await pool.query(
        `UPDATE products
         SET auction_status = 'ended', winner_bidder_id = $1, winner_bidder_name = $2, updated_at = $3
         WHERE id = $4`,
        [winner, winnerName, now, row.id]
      );

      results.push({
        auctionId: row.id,
        winnerBidderId: winner,
        winnerBidderName: winnerName,
      });

      if (winner) {
        await emitNotification(pool, {
          userId: winner,
          title: "Auction Won!",
          message: `You won the auction for "${row.title}". An order will be created shortly.`,
          eventName: "auction_ended",
          eventPayload: { auctionId: row.id },
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error("POST /close-expired-auctions error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /products ─────────────────────────────────────────────────────────
router.post("/", requireRole("vendor"), async (req, res) => {
  try {
    const {
      vendorId,
      vendorName,
      title,
      description,
      category,
      image,
      images,
      productType,
      basePrice,
      stock,
      minOrderQty,
      bulkTiers,
    } = req.body;

    if (!title || !productType) {
      return res.status(400).json({ message: "title and productType are required" });
    }

    const id = uuidv4();
    const now = Date.now();
    const imgArray = images || (image ? [image] : []);

    await pool.query(
      `INSERT INTO products
         (id, vendor_id, vendor_name, title, description, category, images, product_type,
          base_price, stock, min_order_qty, bulk_tiers, approval_status, submitted_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13,$13,$13)`,
      [
        id,
        vendorId || req.actor.userId,
        vendorName || req.actor.name,
        title,
        description,
        category,
        JSON.stringify(imgArray),
        productType,
        basePrice || null,
        stock || null,
        minOrderQty || 1,
        bulkTiers ? JSON.stringify(bulkTiers) : null,
        now,
      ]
    );

    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    res.status(201).json(rowToProduct(rows[0]));
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /products/auctions ─────────────────────────────────────────────────
router.post("/auctions", requireRole("vendor"), async (req, res) => {
  try {
    const {
      vendorId,
      vendorName,
      title,
      description,
      category,
      image,
      images,
      startingPrice,
      bidIncrement,
      auctionStartTime,
      auctionEndTime,
      auctionQuantity,
      buyNowPrice,
      durationDays,
    } = req.body;

    if (!title || !startingPrice) {
      return res.status(400).json({ message: "title and startingPrice are required" });
    }

    const id = uuidv4();
    const now = Date.now();
    const imgArray = images || (image ? [image] : []);

    const startTime = auctionStartTime || now;
    const endTime =
      auctionEndTime || startTime + (durationDays || 3) * 24 * 60 * 60 * 1000;

    await pool.query(
      `INSERT INTO products
         (id, vendor_id, vendor_name, title, description, category, images, product_type,
          is_auction, starting_price, bid_increment, auction_start_time, auction_end_time,
          buy_now_price, auction_quantity, auction_status,
          approval_status, submitted_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'auction',TRUE,$8,$9,$10,$11,$12,$13,'live','pending',$14,$14,$14)`,
      [
        id,
        vendorId || req.actor.userId,
        vendorName || req.actor.name,
        title,
        description,
        category,
        JSON.stringify(imgArray),
        startingPrice,
        bidIncrement || 100,
        startTime,
        endTime,
        buyNowPrice || null,
        auctionQuantity || 1,
        now,
      ]
    );

    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    res.status(201).json(rowToProduct(rows[0]));
  } catch (err) {
    console.error("POST /products/auctions error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /products/vendors/:vendorId/visibility ─────────────────────────────
router.patch("/vendors/:vendorId/visibility", requireRole("superAdmin"), async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { isActive } = req.body;
    const now = Date.now();

    await pool.query(
      `UPDATE products SET is_active = $1, updated_at = $2 WHERE vendor_id = $3`,
      [isActive, now, vendorId]
    );

    const { rows } = await pool.query("SELECT * FROM products WHERE vendor_id = $1", [vendorId]);
    res.json(rows.map(rowToProduct));
  } catch (err) {
    console.error("PATCH /vendors/:vendorId/visibility error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /products/:id ───────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    const product = rowToProduct(rows[0]);
    if (rows[0].is_auction) {
      product.bids = await getBidsForProduct(req.params.id);
    }
    res.json(product);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /products/:id ─────────────────────────────────────────────────────
router.patch("/:id", requireRole("vendor", "superAdmin"), async (req, res) => {
  try {
    const { title, description, category, basePrice, stock, minOrderQty, images } = req.body;
    const now = Date.now();

    const fields = [];
    const values = [];
    let i = 1;

    if (title !== undefined)        { fields.push(`title = $${i++}`);          values.push(title); }
    if (description !== undefined)  { fields.push(`description = $${i++}`);    values.push(description); }
    if (category !== undefined)     { fields.push(`category = $${i++}`);       values.push(category); }
    if (basePrice !== undefined)    { fields.push(`base_price = $${i++}`);     values.push(basePrice); }
    if (stock !== undefined)        { fields.push(`stock = $${i++}`);          values.push(stock); }
    if (minOrderQty !== undefined)  { fields.push(`min_order_qty = $${i++}`);  values.push(minOrderQty); }
    if (images !== undefined)       { fields.push(`images = $${i++}`);         values.push(JSON.stringify(images)); }

    if (!fields.length) return res.status(400).json({ message: "Nothing to update" });

    fields.push(`updated_at = $${i++}`);
    values.push(now);
    values.push(req.params.id);

    await pool.query(`UPDATE products SET ${fields.join(", ")} WHERE id = $${i}`, values);

    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error("PATCH /products/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /products/:id ─────────────────────────────────────────────────────
router.delete("/:id", requireRole("vendor", "superAdmin"), async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /products/:id/approve ───────────────────────────────────────────────
router.post("/:id/approve", requireRole("superAdmin"), async (req, res) => {
  try {
    const now = Date.now();
    const { rows } = await pool.query(
      `UPDATE products
       SET approval_status = 'approved', approved_at = $1, approved_by = $2, updated_at = $1
       WHERE id = $3
       RETURNING *`,
      [now, req.actor.userId, req.params.id]
    );

    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    const product = rowToProduct(rows[0]);

    // Notify the vendor
    await emitNotification(pool, {
      userId: rows[0].vendor_id,
      title: "Product Approved!",
      message: `Your product "${rows[0].title}" has been approved and is now live on the marketplace.`,
      eventName: "product_approved",
      eventPayload: { product },
    });

    res.json(product);
  } catch (err) {
    console.error("POST /products/:id/approve error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /products/:id/reject ────────────────────────────────────────────────
router.post("/:id/reject", requireRole("superAdmin"), async (req, res) => {
  try {
    const { reason } = req.body;
    const now = Date.now();
    const { rows } = await pool.query(
      `UPDATE products
       SET approval_status = 'rejected', rejection_reason = $1, rejected_at = $2, updated_at = $2
       WHERE id = $3
       RETURNING *`,
      [reason || null, now, req.params.id]
    );

    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    const product = rowToProduct(rows[0]);

    await emitNotification(pool, {
      userId: rows[0].vendor_id,
      title: "Product Rejected",
      message: `Your product "${rows[0].title}" was rejected.${reason ? ` Reason: ${reason}` : ""}`,
      eventName: "product_rejected",
      eventPayload: { product },
    });

    res.json(product);
  } catch (err) {
    console.error("POST /products/:id/reject error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /products/:id/visibility ──────────────────────────────────────────
router.patch("/:id/visibility", requireRole("vendor", "superAdmin"), async (req, res) => {
  try {
    const { isActive } = req.body;
    const now = Date.now();
    const { rows } = await pool.query(
      `UPDATE products SET is_active = $1, updated_at = $2 WHERE id = $3 RETURNING *`,
      [isActive, now, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error("PATCH /products/:id/visibility error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /products/:id/bids ──────────────────────────────────────────────────
router.post("/:id/bids", requireRole("buyer"), async (req, res) => {
  try {
    const { bidderId, bidderName, amount } = req.body;
    const productId = req.params.id;

    const { rows: pRows } = await pool.query("SELECT * FROM products WHERE id = $1", [productId]);
    if (!pRows.length) return res.status(404).json({ message: "Product not found" });

    const product = pRows[0];
    if (!product.is_auction) return res.status(400).json({ message: "Not an auction" });
    if (product.auction_status !== "live") return res.status(400).json({ message: "Auction is not live" });
    if (Date.now() > parseInt(product.auction_end_time)) return res.status(400).json({ message: "Auction has ended" });

    const minBid =
      parseFloat(product.current_highest_bid || product.starting_price) +
      parseFloat(product.bid_increment || 0);

    if (parseFloat(amount) < minBid) {
      return res.status(400).json({ message: `Minimum bid is ${minBid}` });
    }

    const bidId = uuidv4();
    const now = Date.now();

    await pool.query(
      `INSERT INTO bids (id, product_id, bidder_id, bidder_name, amount, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bidId, productId, bidderId || req.actor.userId, bidderName || req.actor.name, amount, now]
    );

    await pool.query(
      `UPDATE products SET current_highest_bid = $1, winner_bidder_id = $2, winner_bidder_name = $3, updated_at = $4 WHERE id = $5`,
      [amount, bidderId || req.actor.userId, bidderName || req.actor.name, now, productId]
    );

    const bids = await getBidsForProduct(productId);
    const { rows: updated } = await pool.query("SELECT * FROM products WHERE id = $1", [productId]);
    const updatedProduct = rowToProduct(updated[0]);
    updatedProduct.bids = bids;

    // Broadcast bid to all (auction room)
    try {
      const { getIo } = require("../socket");
      getIo().emit("auction_bid", { productId, bid: bids[bids.length - 1], product: updatedProduct });
    } catch (_) {}

    res.json(updatedProduct);
  } catch (err) {
    console.error("POST /products/:id/bids error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /products/:id/close-auction ─────────────────────────────────────────
router.post("/:id/close-auction", requireRole("superAdmin", "vendor"), async (req, res) => {
  try {
    const productId = req.params.id;
    const bids = await getBidsForProduct(productId);
    const topBid = bids.sort((a, b) => b.amount - a.amount)[0];

    const winner = topBid ? topBid.bidderId : null;
    const winnerName = topBid ? topBid.bidderName : null;
    const now = Date.now();

    const { rows } = await pool.query(
      `UPDATE products
       SET auction_status = 'ended', winner_bidder_id = $1, winner_bidder_name = $2, updated_at = $3
       WHERE id = $4
       RETURNING *`,
      [winner, winnerName, now, productId]
    );

    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    const product = rowToProduct(rows[0]);
    product.bids = bids;

    if (winner) {
      await emitNotification(pool, {
        userId: winner,
        title: "Auction Won!",
        message: `You won the auction for "${rows[0].title}". An order will be created for you.`,
        eventName: "auction_ended",
        eventPayload: { product },
      });
    }

    res.json({ product, winnerBidderId: winner, winnerBidderName: winnerName });
  } catch (err) {
    console.error("POST /products/:id/close-auction error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /products/:id/cancel-auction ────────────────────────────────────────
router.post("/:id/cancel-auction", requireRole("superAdmin", "vendor"), async (req, res) => {
  try {
    const now = Date.now();
    const { rows } = await pool.query(
      `UPDATE products SET auction_status = 'cancelled', updated_at = $1 WHERE id = $2 RETURNING *`,
      [now, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error("POST /products/:id/cancel-auction error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /products/:id/winner-order ─────────────────────────────────────────
router.patch("/:id/winner-order", async (req, res) => {
  try {
    const { orderId } = req.body;
    const now = Date.now();
    const { rows } = await pool.query(
      `UPDATE products SET winner_order_id = $1, updated_at = $2 WHERE id = $3 RETURNING *`,
      [orderId, now, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error("PATCH /products/:id/winner-order error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
