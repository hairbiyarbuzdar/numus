const express = require("express");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
const OTP_TTL_SECONDS = 300;
const otpSessions = new Map();

function normalizePhone(value = "") {
  return String(value).replace(/[^\d+]/g, "").trim();
}

function toRole(userType) {
  if (userType === "farmer") return "vendor";
  if (userType === "customer") return "buyer";
  return "superAdmin";
}

function makeFallbackDisplayName(userType, phone) {
  const label = userType === "customer" ? "Customer" : "Farmer";
  const suffix = phone.slice(-4) || "User";
  return `${label} ${suffix}`;
}

function pruneExpiredOtpSessions() {
  const now = Date.now();
  for (const [transactionId, session] of otpSessions.entries()) {
    if (session.expiresAt <= now) {
      otpSessions.delete(transactionId);
    }
  }
}

async function findUserByPhone(phone, userType) {
  if (!userType) {
    const { rows } = await pool.query("SELECT * FROM users WHERE phone = $1", [phone]);
    return rows[0] || null;
  }

  const { rows } = await pool.query("SELECT * FROM users WHERE phone = $1 AND user_type = $2", [phone, userType]);
  return rows[0] || null;
}

async function findAnyUserByPhone(phone) {
  const { rows } = await pool.query("SELECT * FROM users WHERE phone = $1", [phone]);
  return rows[0] || null;
}

async function ensureDefaultAdminUser() {
  const now = Date.now();
  await pool.query(
    `INSERT INTO users (id, phone, display_name, role, user_type, created_at, verified, is_active, photo_url, city)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (phone) DO NOTHING`,
    [
      "admin_root",
      "+923001112233",
      "Platform Admin",
      "superAdmin",
      "admin",
      now,
      true,
      true,
      "/numulogo.png",
      "Islamabad",
    ]
  );
}

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(
    { userId: user.id, role: user.role, email: user.email || null },
    secret,
    { expiresIn: "30d" }
  );
}

async function sendEmailOtp(email, code) {
  if (!process.env.BREVO_API_KEY) return { deliveryMode: "demo" };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { email: process.env.EMAIL_FROM || "noreply@yourdomain.com", name: "Numu" },
      to: [{ email }],
      subject: "Your Numu verification code",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#16a34a">Your Numu OTP</h2>
          <p>Use this code to sign in. It expires in ${OTP_TTL_SECONDS / 60} minutes.</p>
          <div style="font-size:2rem;font-weight:700;letter-spacing:0.3em;padding:16px 0">${code}</div>
          <p style="color:#6b7280;font-size:0.85rem">If you didn't request this, you can ignore the email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo email delivery failed: ${errorText}`);
  }

  return { deliveryMode: "email" };
}

async function sendWhatsappOtp(phone, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    return { deliveryMode: "demo" };
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: `whatsapp:${fromNumber}`,
      To: `whatsapp:${phone}`,
      Body: `Your Numu verification code is ${code}. It will expire in ${OTP_TTL_SECONDS} seconds.`,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp delivery failed: ${errorText}`);
  }

  return { deliveryMode: "whatsapp" };
}

function rowToUser(row) {
  return {
    uid: row.id,
    phoneNumber: row.phone,
    displayName: row.display_name,
    role: row.role,
    userType: row.user_type,
    email: row.email || "",
    city: row.city || "",
    photoURL: row.photo_url || "",
    isActive: row.is_active,
    verified: row.verified,
    createdAt: parseInt(row.created_at),
  };
}

router.post("/otp/request", async (req, res) => {
  try {
    await ensureDefaultAdminUser();
    pruneExpiredOtpSessions();

    const phone = normalizePhone(req.body.phone || req.body.phoneNumber);
    const userType = req.body.userType || null;

    if (!phone) {
      return res.status(400).json({ message: "WhatsApp number is required" });
    }

    if (userType && !["farmer", "customer", "admin"].includes(userType)) {
      return res.status(400).json({ message: "Invalid user type" });
    }

    const user = await findUserByPhone(phone, userType);
    const anyUser = user || (userType ? await findAnyUserByPhone(phone) : null);

    if (user && !user.is_active) {
      return res.status(403).json({ message: "This account is deactivated. Contact admin." });
    }

    if (!user && anyUser && userType && anyUser.user_type !== userType) {
      return res.status(409).json({
        message: `This WhatsApp number is already registered as ${anyUser.user_type}.`,
      });
    }

    if (!user && !userType) {
      return res.status(404).json({ message: "Account not found for this WhatsApp number." });
    }

    const transactionId = uuidv4();
    const code = `${Math.floor(100000 + Math.random() * 900000)}`;

    otpSessions.set(transactionId, {
      transactionId,
      phone,
      userType,
      code,
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    });

    const delivery = await sendWhatsappOtp(phone, code);
    console.log(`[auth] OTP for ${phone}${userType ? ` (${userType})` : ""}: ${code}`);

    return res.status(201).json({
      transactionId,
      expiresInSeconds: OTP_TTL_SECONDS,
      devCode: delivery.deliveryMode === "demo" && process.env.NODE_ENV !== "production" ? code : "",
    });
  } catch (err) {
    console.error("POST /auth/otp/request error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/otp/verify", async (req, res) => {
  try {
    await ensureDefaultAdminUser();
    pruneExpiredOtpSessions();

    const transactionId = String(req.body.transactionId || "").trim();
    const phone = normalizePhone(req.body.phone || req.body.phoneNumber);
    const otpCode = String(req.body.otpCode || req.body.code || "").trim();
    const userType = req.body.userType || null;

    if (!transactionId || !phone || !otpCode) {
      return res.status(400).json({ message: "transactionId, phone and otpCode are required" });
    }

    const otpSession = otpSessions.get(transactionId);
    if (!otpSession) {
      return res.status(400).json({ message: "OTP session expired. Please resend code." });
    }

    if (otpSession.expiresAt <= Date.now()) {
      otpSessions.delete(transactionId);
      return res.status(400).json({ message: "OTP expired. Please resend code." });
    }

    if (otpSession.phone !== phone || otpSession.code !== otpCode) {
      return res.status(400).json({ message: "Invalid verification code." });
    }

    if ((otpSession.userType || null) !== (userType || null)) {
      return res.status(400).json({ message: "OTP session does not match the selected account type." });
    }

    let user = await findUserByPhone(phone, userType);
    const anyUser = user || (userType ? await findAnyUserByPhone(phone) : null);

    if (user && !user.is_active) {
      otpSessions.delete(transactionId);
      return res.status(403).json({ message: "This account is deactivated. Contact admin." });
    }

    if (!user && anyUser && userType && anyUser.user_type !== userType) {
      otpSessions.delete(transactionId);
      return res.status(409).json({
        message: `This WhatsApp number is already registered as ${anyUser.user_type}.`,
      });
    }

    if (!user) {
      if (!userType || !["farmer", "customer"].includes(userType)) {
        otpSessions.delete(transactionId);
        return res.status(404).json({ message: "Account not found for this WhatsApp number." });
      }

      const id = uuidv4();
      const now = Date.now();
      const displayName = makeFallbackDisplayName(userType, phone);
      const { rows } = await pool.query(
        `INSERT INTO users (id, phone, display_name, role, user_type, created_at, verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, phone, displayName, toRole(userType), userType, now, true]
      );
      user = rows[0];
    } else {
      const { rows } = await pool.query(
        `UPDATE users
         SET verified = TRUE
         WHERE id = $1
         RETURNING *`,
        [user.id]
      );
      user = rows[0];
    }

    otpSessions.delete(transactionId);
    res.json(rowToUser(user));
  } catch (err) {
    console.error("POST /auth/otp/verify error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /auth/register ──────────────────────────────────────────────────────
// Creates a user (called after OTP verification on frontend)
router.post("/register", async (req, res) => {
  try {
    const { uid, phone, displayName, role, userType, email, city } = req.body;

    if (!phone || !displayName || !role) {
      return res.status(400).json({ message: "phone, displayName and role are required" });
    }

    const id = uid || uuidv4();
    const now = Date.now();

    // Upsert — if user already exists (re-register), update name/email
    await pool.query(
      `INSERT INTO users (id, phone, display_name, role, user_type, email, city, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (phone) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             email = EXCLUDED.email,
             city = EXCLUDED.city`,
      [id, phone, displayName, role, userType || null, email || null, city || null, now]
    );

    const { rows } = await pool.query("SELECT * FROM users WHERE phone = $1", [phone]);
    res.status(201).json(rowToUser(rows[0]));
  } catch (err) {
    console.error("POST /auth/register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
// Simple phone-based lookup (OTP is handled frontend; backend just returns user)
router.post("/login", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "phone is required" });

    const { rows } = await pool.query("SELECT * FROM users WHERE phone = $1", [phone]);
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    res.json(rowToUser(rows[0]));
  } catch (err) {
    console.error("POST /auth/login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── GET /auth/users ──────────────────────────────────────────────────────────
router.get("/users", requireRole("superAdmin"), async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    res.json(rows.map(rowToUser));
  } catch (err) {
    console.error("GET /auth/users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /auth/users/:id ────────────────────────────────────────────────────
router.patch("/users/:id", requireRole("superAdmin"), async (req, res) => {
  try {
    const { displayName, email, city, verified } = req.body;

    const fields = [];
    const values = [];
    let i = 1;

    if (displayName !== undefined) { fields.push(`display_name = $${i++}`); values.push(displayName); }
    if (email !== undefined)       { fields.push(`email = $${i++}`);        values.push(email); }
    if (city !== undefined)        { fields.push(`city = $${i++}`);         values.push(city); }
    if (verified !== undefined)    { fields.push(`verified = $${i++}`);     values.push(verified); }

    if (!fields.length) return res.status(400).json({ message: "Nothing to update" });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json(rowToUser(rows[0]));
  } catch (err) {
    console.error("PATCH /auth/users/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── PATCH /auth/users/:id/active ────────────────────────────────────────────
router.patch("/users/:id/active", requireRole("superAdmin"), async (req, res) => {
  try {
    const { isActive } = req.body;
    const { rows } = await pool.query(
      `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *`,
      [isActive, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json(rowToUser(rows[0]));
  } catch (err) {
    console.error("PATCH /auth/users/:id/active error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /auth/email/otp/request ────────────────────────────────────────────
router.post("/email/otp/request", async (req, res) => {
  try {
    pruneExpiredOtpSessions();

    const email = String(req.body.email || "").trim().toLowerCase();
    const userType = req.body.userType || null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    if (userType && !["farmer", "customer", "admin"].includes(userType)) {
      return res.status(400).json({ message: "Invalid user type" });
    }

    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0] || null;

    if (!user && !userType) {
      return res.status(404).json({ message: "No account found for this email." });
    }

    if (user && !user.is_active) {
      return res.status(403).json({ message: "This account is deactivated. Contact admin." });
    }

    const transactionId = uuidv4();
    const code = `${Math.floor(100000 + Math.random() * 900000)}`;

    otpSessions.set(transactionId, {
      transactionId,
      email,
      userType: user ? user.user_type : userType,
      code,
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    });

    const delivery = await sendEmailOtp(email, code);
    console.log(`[auth] Email OTP for ${email}: ${code}`);

    return res.status(201).json({
      transactionId,
      expiresInSeconds: OTP_TTL_SECONDS,
      devCode: delivery.deliveryMode === "demo" && process.env.NODE_ENV !== "production" ? code : "",
    });
  } catch (err) {
    console.error("POST /auth/email/otp/request error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── POST /auth/email/otp/verify ─────────────────────────────────────────────
router.post("/email/otp/verify", async (req, res) => {
  try {
    pruneExpiredOtpSessions();

    const transactionId = String(req.body.transactionId || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const otpCode = String(req.body.otpCode || req.body.code || "").trim();

    if (!transactionId || !email || !otpCode) {
      return res.status(400).json({ message: "transactionId, email and otpCode are required" });
    }

    const session = otpSessions.get(transactionId);
    if (!session) {
      return res.status(400).json({ message: "OTP session expired. Please resend code." });
    }
    if (session.expiresAt <= Date.now()) {
      otpSessions.delete(transactionId);
      return res.status(400).json({ message: "OTP expired. Please resend code." });
    }
    if (session.email !== email || session.code !== otpCode) {
      return res.status(400).json({ message: "Invalid verification code." });
    }

    otpSessions.delete(transactionId);

    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    let user = rows[0] || null;

    if (user && !user.is_active) {
      return res.status(403).json({ message: "This account is deactivated. Contact admin." });
    }

    if (!user) {
      const userType = session.userType || "customer";
      const id = uuidv4();
      const now = Date.now();
      const displayName = email.split("@")[0];
      const result = await pool.query(
        `INSERT INTO users (id, email, display_name, role, user_type, created_at, verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, email, displayName, toRole(userType), userType, now, true]
      );
      user = result.rows[0];
    } else {
      const result = await pool.query(
        "UPDATE users SET verified = TRUE WHERE id = $1 RETURNING *",
        [user.id]
      );
      user = result.rows[0];
    }

    const token = signToken(user);
    res.json({ ...rowToUser(user), token });
  } catch (err) {
    console.error("POST /auth/email/otp/verify error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── DELETE /auth/users/:id ───────────────────────────────────────────────────
router.delete("/users/:id", requireRole("superAdmin"), async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: "User not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /auth/users/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
