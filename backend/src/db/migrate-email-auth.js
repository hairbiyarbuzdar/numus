/**
 * Run once on any environment to support email-based auth.
 * Usage: node src/db/migrate-email-auth.js
 */

require("dotenv").config();
const pool = require("./index");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running email-auth migration...");

    await client.query(`
      -- Allow email-only users (no phone required)
      ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

      -- Fast lookup by email
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;
    `);

    console.log("✅ Email-auth migration complete.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
