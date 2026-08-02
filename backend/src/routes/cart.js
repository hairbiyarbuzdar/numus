const express = require("express");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * The cart stores product_id + qty only. Titles, images and prices are joined
 * from the product on read, so a basket can never show a price that has since
 * changed — the exception is `custom_price`, which records an agreed one-off
 * price (an auction buy-now) that isn't derivable from the product.
 */
function rowToCartItem(row) {
  const basePrice = row.base_price !== null ? parseFloat(row.base_price) : 0;
  const customPrice = row.custom_price !== null ? parseFloat(row.custom_price) : undefined;
  const images = row.images || [];

  return {
    productId: row.product_id,
    title: row.title,
    image: images[0] || "",
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    basePrice: customPrice ?? basePrice,
    bulkTiers: row.bulk_tiers || undefined,
    qty: row.qty,
    customPrice,
  };
}

const SELECT_CART = `
  SELECT c.product_id, c.qty, c.custom_price, c.created_at,
         p.title, p.images, p.vendor_id, p.vendor_name, p.base_price, p.bulk_tiers
  FROM cart_items c
  JOIN products p ON p.id = c.product_id
  WHERE c.user_id = $1
  ORDER BY c.created_at ASC`;

const loadCart = async (userId) => {
  const { rows } = await pool.query(SELECT_CART, [userId]);
  return rows.map(rowToCartItem);
};

// ─── GET /cart ────────────────────────────────────────────────────────────────
router.get("/", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    res.json(await loadCart(req.actor.userId));
  } catch (err) {
    console.error("GET /cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /cart ───────────────────────────────────────────────────────────────
// Adds qty to the line if the product is already in the cart.
router.post("/", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    const { productId, qty, customPrice } = req.body;
    const quantity = Number(qty);

    if (!productId) return res.status(400).json({ message: "productId is required" });
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "qty must be a whole number of 1 or more" });
    }

    const { rows: productRows } = await pool.query(
      "SELECT id, status, is_active, approval_status FROM products WHERE id = $1",
      [productId]
    );
    if (!productRows.length) return res.status(404).json({ message: "Product not found" });

    const product = productRows[0];
    if (product.approval_status !== "approved" || product.is_active === false) {
      return res.status(400).json({ message: "This product is not available" });
    }
    if (product.status === "out_of_stock") {
      return res.status(400).json({ message: "This product is out of stock" });
    }

    const now = Date.now();
    await pool.query(
      `INSERT INTO cart_items (id, user_id, product_id, qty, custom_price, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6)
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty,
                     custom_price = COALESCE(EXCLUDED.custom_price, cart_items.custom_price),
                     updated_at = EXCLUDED.updated_at`,
      [uuidv4(), req.actor.userId, productId, quantity, customPrice ?? null, now]
    );

    res.status(201).json(await loadCart(req.actor.userId));
  } catch (err) {
    console.error("POST /cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /cart/:productId ───────────────────────────────────────────────────
// Sets an absolute quantity (what the +/- controls and the qty box send).
router.patch("/:productId", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    const quantity = Number(req.body.qty);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "qty must be a whole number of 1 or more" });
    }

    const { rowCount } = await pool.query(
      "UPDATE cart_items SET qty = $1, updated_at = $2 WHERE user_id = $3 AND product_id = $4",
      [quantity, Date.now(), req.actor.userId, req.params.productId]
    );
    if (!rowCount) return res.status(404).json({ message: "Item is not in your cart" });

    res.json(await loadCart(req.actor.userId));
  } catch (err) {
    console.error("PATCH /cart/:productId error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /cart/:productId ──────────────────────────────────────────────────
router.delete("/:productId", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    await pool.query("DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2", [
      req.actor.userId,
      req.params.productId,
    ]);
    res.json(await loadCart(req.actor.userId));
  } catch (err) {
    console.error("DELETE /cart/:productId error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /cart ─────────────────────────────────────────────────────────────
router.delete("/", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    await pool.query("DELETE FROM cart_items WHERE user_id = $1", [req.actor.userId]);
    res.json([]);
  } catch (err) {
    console.error("DELETE /cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /cart/merge ─────────────────────────────────────────────────────────
// Folds a signed-out browser's cart into the account's cart at login, so a
// basket built before signing in isn't lost.
router.post("/merge", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const now = Date.now();

    for (const item of items) {
      const quantity = Number(item?.qty);
      if (!item?.productId || !Number.isInteger(quantity) || quantity < 1) continue;

      // Unknown or withdrawn products are skipped rather than failing the merge.
      // The casts matter: $3 is both inserted into a varchar column and compared
      // against products.id, and Postgres cannot deduce one type for both uses.
      await pool.query(
        `INSERT INTO cart_items (id, user_id, product_id, qty, custom_price, created_at, updated_at)
         SELECT $1::varchar, $2::varchar, $3::varchar, $4::int, $5::numeric, $6::bigint, $6::bigint
         FROM products p
         WHERE p.id = $3::varchar AND p.approval_status = 'approved' AND p.is_active = TRUE
           AND p.status <> 'out_of_stock'
         ON CONFLICT (user_id, product_id)
         DO UPDATE SET qty = GREATEST(cart_items.qty, EXCLUDED.qty), updated_at = EXCLUDED.updated_at`,
        [uuidv4(), req.actor.userId, item.productId, quantity, item.customPrice ?? null, now]
      );
    }

    res.json(await loadCart(req.actor.userId));
  } catch (err) {
    console.error("POST /cart/merge error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
