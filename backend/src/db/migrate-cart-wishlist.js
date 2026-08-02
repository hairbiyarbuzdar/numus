/**
 * Cart and wishlist storage. Both used to live in the browser's localStorage,
 * so a buyer's basket vanished when they changed device or cleared their data.
 *
 * Only product_id + qty (+ any custom price) are stored: titles, images and
 * prices are read from the product at fetch time, so a cart never shows a stale
 * price. Re-runnable.
 *
 * Usage: node src/db/migrate-cart-wishlist.js
 */

require("dotenv").config();
const pool = require("./index");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running cart/wishlist migration...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id            VARCHAR(128)   PRIMARY KEY,
        user_id       VARCHAR(128)   NOT NULL,
        product_id    VARCHAR(128)   NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        qty           INT            NOT NULL CHECK (qty > 0),
        custom_price  NUMERIC(12, 2),
        created_at    BIGINT         NOT NULL,
        updated_at    BIGINT         NOT NULL,
        UNIQUE (user_id, product_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wishlist_items (
        id          VARCHAR(128)  PRIMARY KEY,
        user_id     VARCHAR(128)  NOT NULL,
        product_id  VARCHAR(128)  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        created_at  BIGINT        NOT NULL,
        UNIQUE (user_id, product_id)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_wishlist_items_user ON wishlist_items(user_id);`);

    console.log("✅ Cart/wishlist migration complete.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
