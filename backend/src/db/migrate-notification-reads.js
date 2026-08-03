/**
 * Read-state for the admin notification feed.
 *
 * That feed is derived on the fly from users, products and orders rather than
 * stored as rows, so there is nothing to flip a `read` flag on. What is stable
 * is each entry's key (built from the entity it describes), so the keys an
 * admin has read are recorded here and applied when the feed is rebuilt.
 *
 * Usage: node src/db/migrate-notification-reads.js
 */

require("dotenv").config();
const pool = require("./index");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running notification-reads migration...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_reads (
        user_id           VARCHAR(128) NOT NULL,
        notification_key  VARCHAR(256) NOT NULL,
        read_at           BIGINT       NOT NULL,
        PRIMARY KEY (user_id, notification_key)
      );
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id);`
    );

    console.log("✅ Notification-reads migration complete.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
