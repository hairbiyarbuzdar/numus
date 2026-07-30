/**
 * Run once on any environment to support vendor profile completion + admin approval.
 * Usage: node src/db/migrate-vendor-profile.js
 */

require("dotenv").config();
const pool = require("./index");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running vendor-profile migration...");

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_profile_status VARCHAR(20) NOT NULL DEFAULT 'incomplete'
        CHECK (vendor_profile_status IN ('incomplete', 'pending', 'approved', 'rejected'));
      ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_profile JSONB;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_profile_submitted_at BIGINT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_profile_reviewed_at BIGINT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_profile_reviewed_by VARCHAR(128);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_profile_rejection_reason TEXT;
    `);

    console.log("✅ Vendor-profile migration complete.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
