/**
 * Socket.io setup.
 *
 * Clients join a room named after their userId on connect:
 *   socket.emit('join', { userId: 'abc123' })
 *
 * Server emits these events:
 *   'new_order'         → to vendor room when a customer places an order
 *   'order_status'      → to customer room when admin updates an order status
 *   'product_approved'  → to vendor room when admin approves their product
 *   'product_rejected'  → to vendor room when admin rejects their product
 *   'auction_bid'       → to all clients when a bid is placed
 *   'auction_ended'     → to all clients when an auction closes
 */

let io;

function initSocket(server) {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("join", ({ userId }) => {
      if (userId) {
        socket.join(userId);
      }
    });

    socket.on("disconnect", () => {});
  });

  return io;
}

function getIo() {
  if (!io) throw new Error("Socket.io not initialised");
  return io;
}

/**
 * Emit a notification event and also persist it in DB.
 * Pass the pg pool so this module stays dependency-light.
 */
async function emitNotification(pool, { userId, title, message, eventName, eventPayload }) {
  const { v4: uuidv4 } = require("uuid");
  const notifId = `NTF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const now = Date.now();

  await pool.query(
    `INSERT INTO notifications (id, user_id, title, message, read, created_at)
     VALUES ($1, $2, $3, $4, FALSE, $5)`,
    [notifId, userId, title, message, now]
  );

  // Push to user's socket room
  getIo().to(userId).emit(eventName, {
    notification: { id: notifId, userId, title, message, read: false, createdAt: now },
    ...(eventPayload || {}),
  });
}

module.exports = { initSocket, getIo, emitNotification };
