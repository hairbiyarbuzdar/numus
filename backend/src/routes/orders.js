const express = require("express");
const pool = require("../db");
const { emitNotification } = require("../socket");
const { toLikePattern, parsePositiveInt, parseTimestamp } = require("../utils/sql");

const router = express.Router();

const VALID_ORDER_STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
const VALID_ORDER_SOURCES = ["checkout", "auction"];

// Whitelisted sort keys — never interpolate client input into ORDER BY.
const ORDER_SORT_OPTIONS = {
  newest: "created_at DESC",
  oldest: "created_at ASC",
  total_desc: "total DESC",
  total_asc: "total ASC",
};
const DEFAULT_ORDER_SORT = "newest";
const MAX_PAGE_SIZE = 100;

/**
 * Role scoping plus the optional filters, as one WHERE clause.
 * Buyers see their own orders; vendors see orders containing their items;
 * admins see everything and may narrow by customer or vendor.
 * Returns { where, values, nextIndex } or { error }.
 */
function buildOrderFilters(req) {
  const conditions = [];
  const values = [];
  let i = 1;

  const { customerId, vendorId, status, source, search, dateFrom, dateTo } = req.query;
  const actorRole = req.actor.role;
  const actorId = req.actor.userId;

  // items is JSONB, so match by containment rather than by text. The previous
  // `items::text LIKE '%"vendorId":"x"%'` never matched anything: casting JSONB
  // to text renders it as `"vendorId": "x"`, with a space after the colon.
  const containsVendor = (id) => {
    conditions.push(`items @> $${i++}::jsonb`);
    values.push(JSON.stringify([{ vendorId: id }]));
  };

  if (actorRole === "buyer") {
    conditions.push(`customer_id = $${i++}`);
    values.push(actorId);
  } else if (actorRole === "vendor") {
    containsVendor(actorId);
  } else if (actorRole === "superAdmin") {
    if (customerId) {
      conditions.push(`customer_id = $${i++}`);
      values.push(customerId);
    }
    if (vendorId) {
      containsVendor(vendorId);
    }
  } else {
    return { error: "Forbidden", status: 403 };
  }

  if (status) {
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return { error: `status must be one of: ${VALID_ORDER_STATUSES.join(", ")}` };
    }
    conditions.push(`status = $${i++}`);
    values.push(status);
  }

  if (source) {
    if (!VALID_ORDER_SOURCES.includes(source)) {
      return { error: `source must be one of: ${VALID_ORDER_SOURCES.join(", ")}` };
    }
    conditions.push(`source = $${i++}`);
    values.push(source);
  }

  const fromTimestamp = parseTimestamp(dateFrom);
  if (Number.isNaN(fromTimestamp)) return { error: "dateFrom must be a timestamp or date" };
  if (fromTimestamp !== null) {
    conditions.push(`created_at >= $${i++}`);
    values.push(fromTimestamp);
  }

  const toTimestamp = parseTimestamp(dateTo);
  if (Number.isNaN(toTimestamp)) return { error: "dateTo must be a timestamp or date" };
  if (toTimestamp !== null) {
    conditions.push(`created_at <= $${i++}`);
    values.push(toTimestamp);
  }

  // Order id, buyer name/phone, or any product title in the order.
  const searchTerm = typeof search === "string" ? search.trim() : "";
  if (searchTerm) {
    conditions.push(
      `(id ILIKE $${i} OR customer_info->>'fullName' ILIKE $${i}
        OR customer_info->>'phone' ILIKE $${i} OR items::text ILIKE $${i})`
    );
    values.push(toLikePattern(searchTerm));
    i++;
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
    nextIndex: i,
  };
}

function generateOrderId() {
  const stamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${stamp}-${random}`;
}

function rowToOrder(row) {
  return {
    id: row.id,
    source: row.source,
    auctionId: row.auction_id || undefined,
    customerId: row.customer_id,
    customerInfo: row.customer_info,
    addressInfo: row.address_info,
    paymentMethod: row.payment_method,
    items: row.items,
    subtotal: parseFloat(row.subtotal),
    deliveryFee: parseFloat(row.delivery_fee),
    total: parseFloat(row.total),
    status: row.status,
    createdAt: parseInt(row.created_at),
  };
}

// ─── GET /orders ──────────────────────────────────────────────────────────────
// Scoped by role. Filters: customerId, vendorId (admin only), status, source,
//   search (order id / buyer name / phone / product title), dateFrom, dateTo
// Sorting: sort (see ORDER_SORT_OPTIONS)
// Paging:  page, pageSize — when either is supplied the response becomes
//   { data, page, pageSize, total, totalPages, hasMore } instead of a bare
//   array, so existing callers that expect an array keep working.
router.get("/", async (req, res) => {
  try {
    const filters = buildOrderFilters(req);
    if (filters.error) return res.status(filters.status || 400).json({ message: filters.error });

    const { where, values, nextIndex } = filters;
    const orderBy = ORDER_SORT_OPTIONS[req.query.sort] || ORDER_SORT_OPTIONS[DEFAULT_ORDER_SORT];
    // Stable tiebreaker so a row can't shift between pages when sort keys tie.
    const orderClause = `ORDER BY ${orderBy}, id ASC`;

    const paginated = req.query.page !== undefined || req.query.pageSize !== undefined;

    let sql = `SELECT * FROM orders ${where} ${orderClause}`;
    const queryValues = [...values];
    let page = 1;
    let pageSize = 0;
    let total = 0;

    if (paginated) {
      page = parsePositiveInt(req.query.page, 1);
      pageSize = Math.min(parsePositiveInt(req.query.pageSize, 10), MAX_PAGE_SIZE);

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM orders ${where}`,
        values
      );
      total = countRows[0].total;

      const totalPages = Math.max(Math.ceil(total / pageSize), 1);
      if (page > totalPages) page = totalPages;

      sql += ` LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`;
      queryValues.push(pageSize, (page - 1) * pageSize);
    }

    const { rows } = await pool.query(sql, queryValues);
    const orders = rows.map(rowToOrder);

    if (!paginated) return res.json(orders);

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    res.json({ data: orders, page, pageSize, total, totalPages, hasMore: page < totalPages });
  } catch (err) {
    console.error("GET /orders error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /orders/summary ──────────────────────────────────────────────────────
// Totals for the dashboard and finance views, computed in SQL over the caller's
// own scope. `earnings` counts only delivered orders — money actually realised.
router.get("/summary", async (req, res) => {
  try {
    const filters = buildOrderFilters(req);
    if (filters.error) return res.status(filters.status || 400).json({ message: filters.error });

    const { where, values } = filters;
    const actorId = req.actor.userId;
    const isVendor = req.actor.role === "vendor";

    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total_orders,
         COUNT(*) FILTER (WHERE status = 'Pending')::int    AS pending,
         COUNT(*) FILTER (WHERE status = 'Processing')::int AS processing,
         COUNT(*) FILTER (WHERE status = 'Shipped')::int    AS shipped,
         COUNT(*) FILTER (WHERE status = 'Delivered')::int  AS delivered,
         COUNT(*) FILTER (WHERE status = 'Cancelled')::int  AS cancelled
       FROM orders ${where}`,
      values
    );

    // A vendor's share of an order is only their own items, so revenue has to be
    // summed from the items array rather than from the order total.
    const revenueSql = isVendor
      ? `SELECT
           COALESCE(SUM((item->>'price')::numeric * (item->>'qty')::numeric), 0) AS gross,
           COALESCE(SUM((item->>'price')::numeric * (item->>'qty')::numeric)
             FILTER (WHERE o.status = 'Delivered'), 0) AS earned
         FROM orders o, LATERAL jsonb_array_elements(o.items) AS item
         ${where ? `${where} AND` : "WHERE"} item->>'vendorId' = $${values.length + 1}`
      : `SELECT
           COALESCE(SUM(total), 0) AS gross,
           COALESCE(SUM(total) FILTER (WHERE status = 'Delivered'), 0) AS earned
         FROM orders ${where}`;

    const revenueValues = isVendor ? [...values, actorId] : values;
    const { rows: revenueRows } = await pool.query(revenueSql, revenueValues);

    res.json({
      totalOrders: rows[0].total_orders,
      byStatus: {
        Pending: rows[0].pending,
        Processing: rows[0].processing,
        Shipped: rows[0].shipped,
        Delivered: rows[0].delivered,
        Cancelled: rows[0].cancelled,
      },
      grossRevenue: parseFloat(revenueRows[0].gross),
      earnedRevenue: parseFloat(revenueRows[0].earned),
    });
  } catch (err) {
    console.error("GET /orders/summary error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /orders ─────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      customerId,
      customerInfo,
      addressInfo,
      paymentMethod,
      items,
      subtotal,
      deliveryFee,
      total,
      source,
      auctionId,
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ message: "Order must have items" });
    }

    const id = generateOrderId();
    const now = Date.now();

    await pool.query(
      `INSERT INTO orders
         (id, source, auction_id, customer_id, customer_info, address_info, payment_method,
          items, subtotal, delivery_fee, total, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Pending',$12)`,
      [
        id,
        source || "checkout",
        auctionId || null,
        customerId || req.actor.userId,
        JSON.stringify(customerInfo || {}),
        JSON.stringify(addressInfo || {}),
        paymentMethod || "cod",
        JSON.stringify(items),
        subtotal,
        deliveryFee || 0,
        total,
        now,
      ]
    );

    const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    const order = rowToOrder(rows[0]);

    // Notify each unique vendor that has items in this order. The order is
    // already committed at this point, so a notification failure (socket down,
    // for instance) must not fail the request the buyer is waiting on.
    const vendorIds = [...new Set(items.map((item) => item.vendorId).filter(Boolean))];
    for (const vendorId of vendorIds) {
      const vendorItems = items.filter((i) => i.vendorId === vendorId);
      try {
        await emitNotification(pool, {
          userId: vendorId,
          title: "New Order Received!",
          message: `Order ${id} placed for ${vendorItems.map((i) => i.title).join(", ")}.`,
          eventName: "new_order",
          eventPayload: { order },
        });
      } catch (notifyErr) {
        console.error(`POST /orders: notification to vendor ${vendorId} failed:`, notifyErr.message);
      }
    }

    res.status(201).json(order);
  } catch (err) {
    console.error("POST /orders error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /orders/:id/status ─────────────────────────────────────────────────
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const { rows } = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (!rows.length) return res.status(404).json({ message: "Order not found" });

    const order = rowToOrder(rows[0]);

    // Notify the customer — non-fatal, the status change is already persisted.
    try {
      await emitNotification(pool, {
        userId: order.customerId,
        title: "Order Updated",
        message: `Your order ${order.id} status is now: ${status}.`,
        eventName: "order_status",
        eventPayload: { order },
      });
    } catch (notifyErr) {
      console.error("PATCH /orders/:id/status: notification failed:", notifyErr.message);
    }

    res.json(order);
  } catch (err) {
    console.error("PATCH /orders/:id/status error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
