require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { actorMiddleware } = require("./middleware/auth");
const { initSocket } = require("./socket");

const app = express();
const server = http.createServer(app);

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

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/products",      require("./routes/products"));
app.use("/api/orders",        require("./routes/orders"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/auth",          require("./routes/auth"));

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
