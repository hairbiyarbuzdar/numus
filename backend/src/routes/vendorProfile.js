const express = require("express");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");
const { emitNotification } = require("../socket");

const router = express.Router();

function rowToVendorProfile(row) {
  return {
    vendorId: row.id,
    displayName: row.display_name,
    email: row.email || "",
    city: row.city || "",
    status: row.vendor_profile_status,
    profile: row.vendor_profile || null,
    submittedAt: row.vendor_profile_submitted_at ? parseInt(row.vendor_profile_submitted_at) : null,
    reviewedAt: row.vendor_profile_reviewed_at ? parseInt(row.vendor_profile_reviewed_at) : null,
    rejectionReason: row.vendor_profile_rejection_reason || "",
  };
}

// ─── GET /vendor-profile/me ───────────────────────────────────────────────────
router.get("/me", requireRole("vendor"), async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.actor.userId]);
    if (!rows.length) return res.status(404).json({ message: "Account not found" });
    res.json(rowToVendorProfile(rows[0]));
  } catch (err) {
    console.error("GET /vendor-profile/me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /vendor-profile/submit ──────────────────────────────────────────────
router.post("/submit", requireRole("vendor"), async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query(
      "SELECT vendor_profile_status FROM users WHERE id = $1",
      [req.actor.userId]
    );
    if (!existingRows.length) return res.status(404).json({ message: "Account not found" });

    const currentStatus = existingRows[0].vendor_profile_status;
    if (currentStatus === "approved" || currentStatus === "pending") {
      return res.status(400).json({ message: `Profile cannot be submitted while status is '${currentStatus}'.` });
    }

    const { profile } = req.body;
    if (!profile || typeof profile !== "object") {
      return res.status(400).json({ message: "profile is required" });
    }

    const now = Date.now();
    const { rows } = await pool.query(
      `UPDATE users
       SET vendor_profile = $1,
           vendor_profile_status = 'pending',
           vendor_profile_submitted_at = $2,
           vendor_profile_rejection_reason = NULL
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(profile), now, req.actor.userId]
    );

    res.json(rowToVendorProfile(rows[0]));
  } catch (err) {
    console.error("POST /vendor-profile/submit error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /vendor-profile/queue ────────────────────────────────────────────────
router.get("/queue", requireRole("superAdmin"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE role = 'vendor' AND vendor_profile_status = 'pending' ORDER BY vendor_profile_submitted_at ASC"
    );
    res.json(rows.map(rowToVendorProfile));
  } catch (err) {
    console.error("GET /vendor-profile/queue error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /vendor-profile/:vendorId/approve ───────────────────────────────────
router.post("/:vendorId/approve", requireRole("superAdmin"), async (req, res) => {
  try {
    const now = Date.now();
    const { rows } = await pool.query(
      `UPDATE users
       SET vendor_profile_status = 'approved', vendor_profile_reviewed_at = $1, vendor_profile_reviewed_by = $2
       WHERE id = $3 AND role = 'vendor'
       RETURNING *`,
      [now, req.actor.userId, req.params.vendorId]
    );

    if (!rows.length) return res.status(404).json({ message: "Vendor not found" });

    await emitNotification(pool, {
      userId: rows[0].id,
      title: "Vendor Profile Approved!",
      message: "Your vendor profile has been approved. You can now add products.",
      eventName: "vendor_profile_approved",
      eventPayload: { vendorProfile: rowToVendorProfile(rows[0]) },
    });

    res.json(rowToVendorProfile(rows[0]));
  } catch (err) {
    console.error("POST /vendor-profile/:vendorId/approve error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /vendor-profile/:vendorId/reject ────────────────────────────────────
router.post("/:vendorId/reject", requireRole("superAdmin"), async (req, res) => {
  try {
    const { reason } = req.body;
    const now = Date.now();
    const { rows } = await pool.query(
      `UPDATE users
       SET vendor_profile_status = 'rejected',
           vendor_profile_rejection_reason = $1,
           vendor_profile_reviewed_at = $2,
           vendor_profile_reviewed_by = $3
       WHERE id = $4 AND role = 'vendor'
       RETURNING *`,
      [reason || null, now, req.actor.userId, req.params.vendorId]
    );

    if (!rows.length) return res.status(404).json({ message: "Vendor not found" });

    await emitNotification(pool, {
      userId: rows[0].id,
      title: "Vendor Profile Rejected",
      message: `Your vendor profile was rejected.${reason ? ` Reason: ${reason}` : ""}`,
      eventName: "vendor_profile_rejected",
      eventPayload: { vendorProfile: rowToVendorProfile(rows[0]) },
    });

    res.json(rowToVendorProfile(rows[0]));
  } catch (err) {
    console.error("POST /vendor-profile/:vendorId/reject error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
