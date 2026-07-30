/**
 * Run once on any existing environment to add the indexes behind the admin
 * Auctions listing (search / status + date-range filters / pagination).
 * Fresh databases get these from migrate.js.
 * Usage: node src/db/migrate-auction-filters.js
 */

require("dotenv").config();
const pool = require("./index");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running auction-filters migration...");

    // Scope by product type + the default "newest first" sort.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_type_created ON products(product_type, created_at DESC);
    `);

    // The admin status filter derives from both columns (approval gates the
    // lifecycle). Partial: only auctions are ever filtered this way.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_auction_state ON products(approval_status, auction_status) WHERE is_auction;
    `);

    // Date-range filters and the "ending soonest/latest" sorts.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_auction_start ON products(auction_start_time) WHERE is_auction;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_auction_end ON products(auction_end_time) WHERE is_auction;
    `);

    console.log("✅ Auction-filters migration complete.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
