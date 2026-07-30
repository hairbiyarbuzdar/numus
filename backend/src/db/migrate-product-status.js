/**
 * Run once on any environment to support product publication status
 * (draft / active / out_of_stock / inactive / archived).
 * Usage: node src/db/migrate-product-status.js
 */

require("dotenv").config();
const pool = require("./index");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running product-status migration...");

    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'out_of_stock', 'inactive', 'archived'));
    `);

    // Backfill: products already hidden via the old boolean should start as
    // 'inactive', not the new column's default of 'active'.
    await client.query(`
      UPDATE products SET status = 'inactive' WHERE is_active = FALSE AND status = 'active';
    `);

    // Supports status filtering on the vendor "My Products" listing.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    `);

    console.log("✅ Product-status migration complete.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
