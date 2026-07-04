const express = require("express");
const pool = require("../db");

const router = express.Router();

// ─── GET /notifications ───────────────────────────────────────────────────────
// Returns notifications for the current actor (from x-user-id header)
router.get("/", async (req, res) => {
  try {
    if (!req.actor.userId) return res.status(401).json({ message: "Unauthorized" });

    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.actor.userId]
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        message: r.message,
        read: r.read,
        createdAt: parseInt(r.created_at),
      }))
    );
  } catch (err) {
    console.error("GET /notifications error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /notifications/read-all (must be before /:id/read) ────────────────
router.patch("/read-all", async (req, res) => {
  try {
    if (!req.actor.userId) return res.status(401).json({ message: "Unauthorized" });
    await pool.query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [req.actor.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /notifications/read-all error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /notifications/:id/read ────────────────────────────────────────────
router.patch("/:id/read", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.actor.userId]
    );
    if (!rows.length) return res.status(404).json({ message: "Notification not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /notifications/:id/read error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
