const express = require("express");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * Stores product ids only; the product itself is joined on read so a wishlisted
 * item always reflects its current price and availability.
 */
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
    basePrice: row.base_price ? parseFloat(row.base_price) : undefined,
    stock: row.stock,
    minOrderQty: row.min_order_qty,
    isAuction: row.is_auction,
    startingPrice: row.starting_price ? parseFloat(row.starting_price) : undefined,
    currentHighestBid: row.current_highest_bid ? parseFloat(row.current_highest_bid) : undefined,
    auctionEndTime: row.auction_end_time ? parseInt(row.auction_end_time) : undefined,
    auctionStatus: row.auction_status || undefined,
    isActive: row.is_active,
    status: row.status,
    approvalStatus: row.approval_status,
    isApproved: row.approval_status === "approved",
    rating: row.rating ? parseFloat(row.rating) : 0,
    reviewsCount: row.reviews_count || 0,
    createdAt: row.created_at ? parseInt(row.created_at) : undefined,
  };
}

const SELECT_WISHLIST = `
  SELECT p.*, w.created_at AS wishlisted_at
  FROM wishlist_items w
  JOIN products p ON p.id = w.product_id
  WHERE w.user_id = $1
  ORDER BY w.created_at DESC`;

const loadWishlist = async (userId) => {
  const { rows } = await pool.query(SELECT_WISHLIST, [userId]);
  return rows.map(rowToProduct);
};

// ─── GET /wishlist ────────────────────────────────────────────────────────────
router.get("/", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    res.json(await loadWishlist(req.actor.userId));
  } catch (err) {
    console.error("GET /wishlist error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /wishlist ───────────────────────────────────────────────────────────
router.post("/", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "productId is required" });

    const { rows } = await pool.query("SELECT id FROM products WHERE id = $1", [productId]);
    if (!rows.length) return res.status(404).json({ message: "Product not found" });

    // Wishlisting twice is a no-op rather than an error — the button is a toggle.
    await pool.query(
      `INSERT INTO wishlist_items (id, user_id, product_id, created_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [uuidv4(), req.actor.userId, productId, Date.now()]
    );

    res.status(201).json(await loadWishlist(req.actor.userId));
  } catch (err) {
    console.error("POST /wishlist error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /wishlist/:productId ──────────────────────────────────────────────
router.delete("/:productId", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    await pool.query("DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2", [
      req.actor.userId,
      req.params.productId,
    ]);
    res.json(await loadWishlist(req.actor.userId));
  } catch (err) {
    console.error("DELETE /wishlist/:productId error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /wishlist/merge ─────────────────────────────────────────────────────
// Folds a signed-out browser's wishlist into the account at login.
router.post("/merge", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    const productIds = Array.isArray(req.body.productIds) ? req.body.productIds : [];
    const now = Date.now();

    for (const productId of productIds) {
      if (!productId) continue;
      // Casts required: $3 is both inserted and compared against products.id.
      await pool.query(
        `INSERT INTO wishlist_items (id, user_id, product_id, created_at)
         SELECT $1::varchar, $2::varchar, $3::varchar, $4::bigint
         FROM products p WHERE p.id = $3::varchar
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [uuidv4(), req.actor.userId, productId, now]
      );
    }

    res.json(await loadWishlist(req.actor.userId));
  } catch (err) {
    console.error("POST /wishlist/merge error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
