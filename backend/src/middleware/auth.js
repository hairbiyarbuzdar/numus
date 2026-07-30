const jwt = require("jsonwebtoken");
const pool = require("../db");

const ROLE_MAP = {
  farmer: "vendor",
  customer: "buyer",
  admin: "superAdmin",
};

function actorMiddleware(req, _res, next) {
  // Prefer JWT from Authorization header
  const authHeader = req.headers["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const payload = jwt.verify(token, secret);
        req.actor = { userId: payload.userId, role: payload.role, name: payload.name || null };
        return next();
      } catch {
        // fall through to legacy headers
      }
    }
  }

  // Legacy header-based auth (backward compat during transition)
  const rawRole = req.headers["x-user-role"] || null;
  req.actor = {
    userId: req.headers["x-user-id"] || null,
    role: rawRole ? (ROLE_MAP[rawRole] || rawRole) : null,
    name: req.headers["x-user-name"] || null,
  };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.actor.userId) {
      return res.status(401).json({ message: "Unauthorized — no actor" });
    }
    if (roles.length && !roles.includes(req.actor.role)) {
      return res.status(403).json({ message: `Forbidden — requires role: ${roles.join(" | ")}` });
    }
    next();
  };
}

async function requireApprovedVendor(req, res, next) {
  try {
    const { rows } = await pool.query("SELECT vendor_profile_status FROM users WHERE id = $1", [req.actor.userId]);
    const status = rows[0]?.vendor_profile_status;
    if (status !== "approved") {
      return res.status(403).json({ message: "Your vendor profile must be approved by an admin before you can do this." });
    }
    next();
  } catch (err) {
    console.error("requireApprovedVendor error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { actorMiddleware, requireRole, requireApprovedVendor };
