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

// ─── GET /notifications/reads ─────────────────────────────────────────────────
// Keys the caller has already read in the derived admin feed. That feed is
// rebuilt from users/products/orders on each load, so its read state cannot
// live on a notification row — it is keyed by entry instead.
router.get("/reads", async (req, res) => {
  try {
    if (!req.actor.userId) return res.status(401).json({ message: "Unauthorized" });

    const { rows } = await pool.query(
      "SELECT notification_key FROM notification_reads WHERE user_id = $1",
      [req.actor.userId]
    );
    res.json({ keys: rows.map((row) => row.notification_key) });
  } catch (err) {
    console.error("GET /notifications/reads error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /notifications/reads ────────────────────────────────────────────────
// Body: { keys: string[] } — marks one entry or the whole feed as read.
router.post("/reads", async (req, res) => {
  try {
    if (!req.actor.userId) return res.status(401).json({ message: "Unauthorized" });

    const keys = Array.isArray(req.body.keys) ? req.body.keys : [];
    const usable = keys.filter((key) => typeof key === "string" && key.length && key.length <= 256);

    if (usable.length) {
      const now = Date.now();
      // One statement rather than a loop: "mark all as read" can be hundreds.
      await pool.query(
        `INSERT INTO notification_reads (user_id, notification_key, read_at)
         SELECT $1, UNNEST($2::text[]), $3
         ON CONFLICT (user_id, notification_key) DO NOTHING`,
        [req.actor.userId, usable, now]
      );
    }

    const { rows } = await pool.query(
      "SELECT notification_key FROM notification_reads WHERE user_id = $1",
      [req.actor.userId]
    );
    res.status(201).json({ keys: rows.map((row) => row.notification_key) });
  } catch (err) {
    console.error("POST /notifications/reads error:", err);
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
