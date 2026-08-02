require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { actorMiddleware } = require("./middleware/auth");
const { initSocket } = require("./socket");
const { UPLOAD_ROOT } = require("./utils/storage");

const app = express();
const server = http.createServer(app);

// Behind Nginx, so req.protocol/req.get("host") reflect the public URL rather
// than the loopback address — needed to build absolute URLs for uploads.
app.set("trust proxy", true);

// ─── Socket.io ────────────────────────────────────────────────────────────────
initSocket(server);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(actorMiddleware);

// ─── Uploaded files ───────────────────────────────────────────────────────────
// Served under /api so the existing Nginx rule that proxies /api to this
// backend already covers them — no server config change needed.
app.use(
  "/api/uploads",
  express.static(UPLOAD_ROOT, {
    maxAge: "30d",
    // Uploads are content, never code: don't let a stored file be executed or
    // interpreted as anything other than what its extension says.
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/uploads",       require("./routes/uploads"));
app.use("/api/products",      require("./routes/products"));
app.use("/api/orders",        require("./routes/orders"));
app.use("/api/me",            require("./routes/me"));
app.use("/api/cart",          require("./routes/cart"));
app.use("/api/wishlist",      require("./routes/wishlist"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/vendor-profile", require("./routes/vendorProfile"));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🌱 Numu backend running on http://localhost:${PORT}`);
  console.log(`   API:    http://localhost:${PORT}/api`);
  console.log(`   Socket: ws://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});
