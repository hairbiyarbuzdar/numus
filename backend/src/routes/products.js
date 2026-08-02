const express = require("express");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireRole, requireApprovedVendor } = require("../middleware/auth");
const { emitNotification } = require("../socket");
const { toLikePattern, parsePositiveInt, parseTimestamp } = require("../utils/sql");

const router = express.Router();

const VALID_PRODUCT_STATUSES = ["draft", "active", "out_of_stock", "inactive", "archived"];
const VALID_APPROVAL_STATUSES = ["pending", "approved", "rejected"];
const VALID_PRODUCT_TYPES = ["retail", "wholesale", "auction"];

// Shown whenever an auction edit is refused because the auction is already open
// to bidders — the terms buyers bid against must not change under them.
const AUCTION_LOCKED_MESSAGE = "Auction details cannot be modified after bidding has started.";

// Whitelisted sort keys — never interpolate client input into ORDER BY.
const SORT_OPTIONS = {
  newest: "p.created_at DESC",
  oldest: "p.created_at ASC",
  title_asc: "p.title ASC",
  title_desc: "p.title DESC",
  price_asc: "COALESCE(p.base_price, p.starting_price) ASC NULLS LAST",
  price_desc: "COALESCE(p.base_price, p.starting_price) DESC NULLS LAST",
  stock_asc: "p.stock ASC NULLS LAST",
  stock_desc: "p.stock DESC NULLS LAST",
  ending_soonest: "p.auction_end_time ASC NULLS LAST",
  ending_latest: "p.auction_end_time DESC NULLS LAST",
  bid_asc: "COALESCE(p.current_highest_bid, 0) ASC",
  bid_desc: "COALESCE(p.current_highest_bid, 0) DESC",
};
const DEFAULT_SORT = "newest";

const MAX_PAGE_SIZE = 100;

// The status shown for an auction is derived: the approval workflow gates the
// auction lifecycle, so filtering by it needs both columns. Mirrors
// getAuctionDisplayStatus() in utils/helpers.ts. Each clause is self-contained
// because they are AND-joined with the other filters.
const AUCTION_STATE_FILTERS = {
  pending: "(p.approval_status = 'pending')",
  rejected: "(p.approval_status = 'rejected')",
  active: "(p.approval_status = 'approved' AND p.auction_status = 'live')",
  ended: "(p.approval_status = 'approved' AND p.auction_status = 'ended')",
  cancelled: "(p.approval_status = 'approved' AND p.auction_status = 'cancelled')",
};

// Which timestamp a dateFrom/dateTo range applies to.
const DATE_RANGE_FIELDS = {
  created: "p.created_at",
  start: "p.auction_start_time",
  end: "p.auction_end_time",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the shared WHERE clause for product listings from the request.
 * Returns { where, values, nextIndex } or { error } for invalid filter values.
 */
function buildProductFilters(req, startIndex = 1) {
  const conditions = [];
  const values = [];
  let i = startIndex;

  const {
    vendorId,
    approvalStatus,
    productType,
    isActive,
    status,
    category,
    search,
    minPrice,
    maxPrice,
    auctionState,
    dateField,
    dateFrom,
    dateTo,
  } = req.query;

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
    if (!VALID_APPROVAL_STATUSES.includes(approvalStatus)) {
      return { error: `approvalStatus must be one of: ${VALID_APPROVAL_STATUSES.join(", ")}` };
    }
    conditions.push(`p.approval_status = $${i++}`);
    values.push(approvalStatus);
  }

  if (productType) {
    if (!VALID_PRODUCT_TYPES.includes(productType)) {
      return { error: `productType must be one of: ${VALID_PRODUCT_TYPES.join(", ")}` };
    }
    conditions.push(`p.product_type = $${i++}`);
    values.push(productType);
  }

  if (status) {
    if (!VALID_PRODUCT_STATUSES.includes(status)) {
      return { error: `status must be one of: ${VALID_PRODUCT_STATUSES.join(", ")}` };
    }
    conditions.push(`p.status = $${i++}`);
    values.push(status);
  }

  if (isActive !== undefined) {
    conditions.push(`p.is_active = $${i++}`);
    values.push(isActive === "true");
  }

  if (category) {
    conditions.push(`p.category = $${i++}`);
    values.push(category);
  }

  if (auctionState !== undefined && auctionState !== "") {
    const clause = AUCTION_STATE_FILTERS[auctionState];
    if (!clause) {
      return { error: `auctionState must be one of: ${Object.keys(AUCTION_STATE_FILTERS).join(", ")}` };
    }
    conditions.push(clause);
  }

  if (dateField !== undefined && dateField !== "" && !DATE_RANGE_FIELDS[dateField]) {
    return { error: `dateField must be one of: ${Object.keys(DATE_RANGE_FIELDS).join(", ")}` };
  }
  const dateColumn = DATE_RANGE_FIELDS[dateField] || DATE_RANGE_FIELDS.created;

  const fromTimestamp = parseTimestamp(dateFrom);
  if (Number.isNaN(fromTimestamp)) return { error: "dateFrom must be a timestamp or date" };
  if (fromTimestamp !== null) {
    conditions.push(`${dateColumn} >= $${i++}`);
    values.push(fromTimestamp);
  }

  const toTimestamp = parseTimestamp(dateTo);
  if (Number.isNaN(toTimestamp)) return { error: "dateTo must be a timestamp or date" };
  if (toTimestamp !== null) {
    conditions.push(`${dateColumn} <= $${i++}`);
    values.push(toTimestamp);
  }

  // Searching by id lets an admin paste a reference straight from a card or an
  // order; vendor_name is matched because the listings show the vendor.
  const searchTerm = typeof search === "string" ? search.trim() : "";
  if (searchTerm) {
    conditions.push(
      `(p.title ILIKE $${i} OR p.description ILIKE $${i} OR p.category ILIKE $${i}
        OR p.vendor_name ILIKE $${i} OR p.id ILIKE $${i})`
    );
    values.push(toLikePattern(searchTerm));
    i++;
  }

  if (minPrice !== undefined && minPrice !== "") {
    const parsed = Number(minPrice);
    if (!Number.isFinite(parsed)) return { error: "minPrice must be a number" };
    conditions.push(`COALESCE(p.base_price, p.starting_price) >= $${i++}`);
    values.push(parsed);
  }

  if (maxPrice !== undefined && maxPrice !== "") {
    const parsed = Number(maxPrice);
    if (!Number.isFinite(parsed)) return { error: "maxPrice must be a number" };
    conditions.push(`COALESCE(p.base_price, p.starting_price) <= $${i++}`);
    values.push(parsed);
  }

  // Buyers only see approved + active products that are published (not draft/inactive/archived)
  if (actorRole === "buyer") {
    conditions.push(`p.approval_status = 'approved'`);
    conditions.push(`p.is_active = TRUE`);
    conditions.push(`p.status IN ('active', 'out_of_stock')`);
    // A withdrawn auction must not appear either. This used to be filtered in
    // the browser, which stopped working once listings were paged server-side.
    conditions.push(`(p.is_auction = FALSE OR p.auction_status <> 'cancelled')`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
    nextIndex: i,
  };
}

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
    status: row.status,
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

/**
 * Bidding is open once the start time has passed or a bid has already landed
 * (a bid can predate the start time on auctions created before that guard
 * existed). A row with no start time is treated as open — it is indistinguishable
 * from an auction that started immediately, so the safe answer is "locked".
 */
async function hasAuctionBiddingStarted(row) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS bid_count FROM bids WHERE product_id = $1",
    [row.id]
  );
  if (rows[0].bid_count > 0) return true;

  const startTime = row.auction_start_time ? parseInt(row.auction_start_time) : null;
  return startTime === null || Date.now() >= startTime;
}

// ─── GET /products ─────────────────────────────────────────────────────────────
// Filters: vendorId, approvalStatus, productType, isActive, status, category,
//          search (title/description/category/vendor/id), minPrice, maxPrice,
//          auctionState (pending|active|rejected|ended|cancelled),
//          dateFrom/dateTo with dateField (created|start|end, default created)
// Sorting: sort (see SORT_OPTIONS)
// Paging:  page, pageSize — when either is supplied the response becomes
//          { data, page, pageSize, total, totalPages, hasMore } instead of a
//          bare array, so existing callers that expect an array keep working.
router.get("/", async (req, res) => {
  try {
    const filters = buildProductFilters(req);
    if (filters.error) return res.status(400).json({ message: filters.error });

    const { where, values, nextIndex } = filters;
    const orderBy = SORT_OPTIONS[req.query.sort] || SORT_OPTIONS[DEFAULT_SORT];
    // Stable tiebreaker so a row can't shift between pages when sort keys tie.
    const orderClause = `ORDER BY ${orderBy}, p.id ASC`;

    const paginated = req.query.page !== undefined || req.query.pageSize !== undefined;

    let sql = `SELECT p.* FROM products p ${where} ${orderClause}`;
    const queryValues = [...values];
    let page = 1;
    let pageSize = 0;
    let total = 0;

    if (paginated) {
      page = parsePositiveInt(req.query.page, 1);
      pageSize = Math.min(parsePositiveInt(req.query.pageSize, 10), MAX_PAGE_SIZE);

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM products p ${where}`,
        values
      );
      total = countRows[0].total;

      // Clamp a page that ran off the end (e.g. after deleting the last row on
      // the final page) back to the last page that has data.
      const totalPages = Math.max(Math.ceil(total / pageSize), 1);
      if (page > totalPages) page = totalPages;

      sql += ` LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`;
      queryValues.push(pageSize, (page - 1) * pageSize);
    }

    const { rows } = await pool.query(sql, queryValues);

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

    if (!paginated) return res.json(products);

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    res.json({
      data: products,
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    });
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /products/filter-options ─────────────────────────────────────────────
// Distinct values available within the caller's own visible product scope, so
// the filter UI only ever offers options that can actually return results.
router.get("/filter-options", async (req, res) => {
  try {
    // Scope by actor/vendor and product type only — ignore the active filters so
    // the dropdowns don't shrink to whatever is already selected. productType is
    // a scope, not a filter: the auctions page must not offer retail categories.
    const scopeReq = {
      actor: req.actor,
      query: { vendorId: req.query.vendorId, productType: req.query.productType },
    };
    const filters = buildProductFilters(scopeReq);
    if (filters.error) return res.status(400).json({ message: filters.error });

    const joiner = filters.where ? "AND" : "WHERE";

    const { rows } = await pool.query(
      `SELECT DISTINCT p.category FROM products p ${filters.where}
       ${joiner} p.category IS NOT NULL AND p.category <> ''
       ORDER BY p.category ASC`,
      filters.values
    );

    // Vendors that actually have listings the caller can see — the marketplace
    // vendor filter must not offer a farmer with nothing on sale.
    const { rows: vendorRows } = await pool.query(
      `SELECT DISTINCT p.vendor_id, p.vendor_name FROM products p ${filters.where}
       ${joiner} p.vendor_name IS NOT NULL AND p.vendor_name <> ''
       ORDER BY p.vendor_name ASC`,
      filters.values
    );

    res.json({
      categories: rows.map((row) => row.category),
      vendors: vendorRows.map((row) => ({ id: row.vendor_id, name: row.vendor_name })),
    });
  } catch (err) {
    console.error("GET /products/filter-options error:", err);
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
router.post("/", requireRole("vendor"), requireApprovedVendor, async (req, res) => {
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
      status,
    } = req.body;

    if (!title || !productType) {
      return res.status(400).json({ message: "title and productType are required" });
    }

    if (status && !VALID_PRODUCT_STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${VALID_PRODUCT_STATUSES.join(", ")}` });
    }

    const id = uuidv4();
    const now = Date.now();
    const imgArray = images || (image ? [image] : []);
    const productStatus = status || "active";
    // Drafts haven't been submitted for admin review yet.
    const submittedAt = productStatus === "draft" ? null : now;

    await pool.query(
      `INSERT INTO products
         (id, vendor_id, vendor_name, title, description, category, images, product_type,
          base_price, stock, min_order_qty, bulk_tiers, status, approval_status, submitted_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15,$15)`,
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
        productStatus,
        submittedAt,
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
router.post("/auctions", requireRole("vendor"), requireApprovedVendor, async (req, res) => {
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
    const { title, description, category, basePrice, stock, minOrderQty, images, status } = req.body;
    const now = Date.now();

    if (status !== undefined && !VALID_PRODUCT_STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${VALID_PRODUCT_STATUSES.join(", ")}` });
    }

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

    if (status !== undefined) {
      fields.push(`status = $${i++}`);
      values.push(status);

      // First time leaving 'draft' is when it actually enters the admin review pipeline.
      if (status !== "draft") {
        const { rows: existingRows } = await pool.query(
          "SELECT submitted_at FROM products WHERE id = $1",
          [req.params.id]
        );
        if (existingRows.length && existingRows[0].submitted_at === null) {
          fields.push(`submitted_at = $${i++}`);
          values.push(now);
        }
      }
    }

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

// ─── PATCH /products/:id/auction ──────────────────────────────────────────────
// Auction counterpart to PATCH /products/:id. A vendor may revise their auction
// while it is still waiting to open; once bidding has started the terms are
// frozen so buyers keep bidding on exactly what they were shown.
router.patch("/:id/auction", requireRole("vendor", "superAdmin"), async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query("SELECT * FROM products WHERE id = $1", [
      req.params.id,
    ]);
    if (!existingRows.length) return res.status(404).json({ message: "Auction not found" });

    const existing = existingRows[0];
    if (!existing.is_auction) return res.status(400).json({ message: "Not an auction" });

    if (req.actor.role === "vendor" && existing.vendor_id !== req.actor.userId) {
      return res.status(403).json({ message: "Forbidden — this auction belongs to another vendor" });
    }

    if (existing.auction_status === "ended") {
      return res.status(409).json({ message: "This auction has ended and can no longer be edited." });
    }
    if (existing.auction_status === "cancelled") {
      return res.status(409).json({ message: "This auction was cancelled and can no longer be edited." });
    }
    if (await hasAuctionBiddingStarted(existing)) {
      return res.status(409).json({ message: AUCTION_LOCKED_MESSAGE });
    }

    const {
      title,
      description,
      category,
      images,
      startingPrice,
      bidIncrement,
      buyNowPrice,
      auctionQuantity,
      auctionStartTime,
      auctionEndTime,
    } = req.body;

    const now = Date.now();
    const fields = [];
    const values = [];
    let i = 1;
    const setField = (column, value) => {
      fields.push(`${column} = $${i++}`);
      values.push(value);
    };

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ message: "title cannot be empty" });
      }
      setField("title", title.trim());
    }
    if (description !== undefined) {
      setField("description", typeof description === "string" ? description.trim() : description);
    }
    if (category !== undefined) {
      if (typeof category !== "string" || !category.trim()) {
        return res.status(400).json({ message: "category cannot be empty" });
      }
      setField("category", category.trim());
    }
    if (images !== undefined) {
      if (!Array.isArray(images) || !images.length) {
        return res.status(400).json({ message: "images must contain at least one image" });
      }
      setField("images", JSON.stringify(images));
    }

    // Effective values — a field the request left out keeps its stored value, so
    // cross-field checks (buy now vs starting price, end vs start) stay correct.
    let nextStartingPrice = existing.starting_price !== null ? parseFloat(existing.starting_price) : null;
    if (startingPrice !== undefined) {
      const parsed = Number(startingPrice);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ message: "Starting price must be greater than 0." });
      }
      nextStartingPrice = parsed;
      setField("starting_price", parsed);
    }

    if (bidIncrement !== undefined) {
      const parsed = Number(bidIncrement);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ message: "Bid increment must be greater than 0." });
      }
      setField("bid_increment", parsed);
    }

    if (auctionQuantity !== undefined) {
      const parsed = Number(auctionQuantity);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return res.status(400).json({ message: "Quantity must be a whole number of 1 or more." });
      }
      setField("auction_quantity", parsed);
    }

    if (buyNowPrice !== undefined) {
      if (buyNowPrice === null || buyNowPrice === "") {
        setField("buy_now_price", null);
      } else {
        const parsed = Number(buyNowPrice);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return res.status(400).json({ message: "Buy now price must be greater than 0." });
        }
        if (nextStartingPrice !== null && parsed < nextStartingPrice) {
          return res.status(400).json({ message: "Buy now price must be at least the starting price." });
        }
        setField("buy_now_price", parsed);
      }
    }

    let nextStartTime = existing.auction_start_time ? parseInt(existing.auction_start_time) : null;
    let nextEndTime = existing.auction_end_time ? parseInt(existing.auction_end_time) : null;

    if (auctionStartTime !== undefined) {
      const parsed = Number(auctionStartTime);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ message: "auctionStartTime must be a timestamp" });
      }
      // A start time in the past would lock the auction the moment it is saved.
      if (parsed <= now) {
        return res.status(400).json({ message: "Auction start time must be in the future." });
      }
      nextStartTime = parsed;
      setField("auction_start_time", parsed);
    }

    if (auctionEndTime !== undefined) {
      const parsed = Number(auctionEndTime);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ message: "auctionEndTime must be a timestamp" });
      }
      nextEndTime = parsed;
      setField("auction_end_time", parsed);
    }

    if (nextEndTime !== null && nextStartTime !== null && nextEndTime <= nextStartTime) {
      return res.status(400).json({ message: "Auction end time must be after the start time." });
    }
    if (nextEndTime !== null && nextEndTime <= now) {
      return res.status(400).json({ message: "Auction end time must be in the future." });
    }

    if (!fields.length) return res.status(400).json({ message: "Nothing to update" });

    setField("updated_at", now);

    // Re-checked in the UPDATE itself: a bid can land between the read above and
    // the write, and that bid must win the race.
    const guardIndex = i++;
    values.push(now);
    const idIndex = i;
    values.push(req.params.id);

    const { rowCount } = await pool.query(
      `UPDATE products SET ${fields.join(", ")}
       WHERE id = $${idIndex}
         AND auction_status = 'live'
         AND auction_start_time > $${guardIndex}
         AND NOT EXISTS (SELECT 1 FROM bids WHERE bids.product_id = products.id)`,
      values
    );
    if (!rowCount) return res.status(409).json({ message: AUCTION_LOCKED_MESSAGE });

    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    const product = rowToProduct(rows[0]);
    product.bids = await getBidsForProduct(req.params.id);
    res.json(product);
  } catch (err) {
    console.error("PATCH /products/:id/auction error:", err);
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

    // Only a verified account may bid. Checked server-side because hiding the
    // form in the UI does not stop a direct request to this endpoint.
    const { rows: bidderRows } = await pool.query("SELECT verified FROM users WHERE id = $1", [
      req.actor.userId,
    ]);
    if (!bidderRows.length) return res.status(403).json({ message: "Bidder account not found" });
    if (bidderRows[0].verified !== true) {
      return res.status(403).json({
        message: "Please verify your account before bidding in auctions.",
      });
    }

    const product = pRows[0];
    if (!product.is_auction) return res.status(400).json({ message: "Not an auction" });
    if (product.auction_status !== "live") return res.status(400).json({ message: "Auction is not live" });

    // Bidding opens at the start time — before that the vendor can still edit
    // the terms (see PATCH /products/:id/auction), so no bid may land yet.
    const startTime = product.auction_start_time ? parseInt(product.auction_start_time) : null;
    if (startTime !== null && Date.now() < startTime) {
      return res.status(400).json({ message: "Bidding has not started for this auction yet." });
    }

    if (Date.now() > parseInt(product.auction_end_time)) return res.status(400).json({ message: "Auction has ended" });

    const minBid =
      parseFloat(product.current_highest_bid || product.starting_price) +
      parseFloat(product.bid_increment || 0);

    if (parseFloat(amount) < minBid) {
      return res.status(400).json({ message: `Minimum bid is ${minBid}` });
    }

    const bidId = uuidv4();
    const now = Date.now();

    // The bidder is whoever is authenticated, never what the request claims —
    // a body-supplied bidderId would let one buyer bid in another's name.
    const bidderUserId = req.actor.userId;
    const bidderDisplayName = req.actor.name || bidderName || "Buyer";

    await pool.query(
      `INSERT INTO bids (id, product_id, bidder_id, bidder_name, amount, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bidId, productId, bidderUserId, bidderDisplayName, amount, now]
    );

    await pool.query(
      `UPDATE products SET current_highest_bid = $1, winner_bidder_id = $2, winner_bidder_name = $3, updated_at = $4 WHERE id = $5`,
      [amount, bidderUserId, bidderDisplayName, now, productId]
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
