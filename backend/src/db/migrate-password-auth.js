/**
 * Run once on any environment to support email + password auth.
 * Usage: node src/db/migrate-password-auth.js
 */

require("dotenv").config();
const pool = require("./index");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running password-auth migration...");

    await client.query(`
      -- Nullable: old/abandoned-signup accounts may not have a password yet
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    `);

    console.log("✅ Password-auth migration complete.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
