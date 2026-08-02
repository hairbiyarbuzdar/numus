const express = require("express");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /me/badges
 *
 * Counts for the header, which is on every page. Cart and wishlist contents
 * themselves load only when their module is opened; this keeps the two little
 * numbers in the navbar correct without pulling either list at login.
 */
router.get("/badges", requireRole("buyer", "vendor", "superAdmin"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(qty) FROM cart_items WHERE user_id = $1), 0)::int AS cart_count,
         COALESCE((SELECT COUNT(*) FROM wishlist_items WHERE user_id = $1), 0)::int AS wishlist_count`,
      [req.actor.userId]
    );

    res.json({ cartCount: rows[0].cart_count, wishlistCount: rows[0].wishlist_count });
  } catch (err) {
    console.error("GET /me/badges error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
