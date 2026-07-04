const express = require("express");
const pool = require("../db");
const { emitNotification } = require("../socket");

const router = express.Router();

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
// Query params: customerId, vendorId
router.get("/", async (req, res) => {
  try {
    const { customerId, vendorId } = req.query;
    const actorRole = req.actor.role;
    const actorId = req.actor.userId;

    let query;
    let values = [];

    if (actorRole === "buyer") {
      // Buyers see only their orders
      query = `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`;
      values = [actorId];
    } else if (actorRole === "vendor") {
      // Vendors see orders that contain their products
      query = `SELECT * FROM orders
               WHERE items::text LIKE $1
               ORDER BY created_at DESC`;
      values = [`%"vendorId":"${actorId}"%`];
    } else if (actorRole === "superAdmin") {
      // Admin sees all, with optional filters
      if (customerId) {
        query = `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`;
        values = [customerId];
      } else if (vendorId) {
        query = `SELECT * FROM orders WHERE items::text LIKE $1 ORDER BY created_at DESC`;
        values = [`%"vendorId":"${vendorId}"%`];
      } else {
        query = `SELECT * FROM orders ORDER BY created_at DESC`;
      }
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { rows } = await pool.query(query, values);
    res.json(rows.map(rowToOrder));
  } catch (err) {
    console.error("GET /orders error:", err);
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

    // Notify each unique vendor that has items in this order
    const vendorIds = [...new Set(items.map((item) => item.vendorId).filter(Boolean))];
    for (const vendorId of vendorIds) {
      const vendorItems = items.filter((i) => i.vendorId === vendorId);
      await emitNotification(pool, {
        userId: vendorId,
        title: "New Order Received!",
        message: `Order ${id} placed for ${vendorItems.map((i) => i.title).join(", ")}.`,
        eventName: "new_order",
        eventPayload: { order },
      });
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

    // Notify the customer
    await emitNotification(pool, {
      userId: order.customerId,
      title: "Order Updated",
      message: `Your order ${order.id} status is now: ${status}.`,
      eventName: "order_status",
      eventPayload: { order },
    });

    res.json(order);
  } catch (err) {
    console.error("PATCH /orders/:id/status error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
