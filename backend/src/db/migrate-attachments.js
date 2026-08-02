/**
 * Converts attachments already stored as base64 data URLs into real files on
 * disk, rewriting the database column to hold the URL instead.
 *
 * Covers product/auction images (products.images) and vendor CNIC documents
 * (users.vendor_profile). Safe to re-run: rows that already hold URLs are
 * skipped, and each row is updated only after its files are written.
 *
 * Usage: node src/db/migrate-attachments.js
 */

require("dotenv").config();
const pool = require("./index");
const { saveDataUrl, isDataUrl } = require("../utils/storage");

const PROFILE_IMAGE_FIELDS = ["cnicFrontImage", "cnicBackImage"];

async function migrateProductImages() {
  const { rows } = await pool.query(
    "SELECT id, product_type, images FROM products WHERE images::text LIKE '%data:%'"
  );

  let converted = 0;
  let files = 0;

  for (const row of rows) {
    const images = Array.isArray(row.images) ? row.images : [];
    const folder = row.product_type === "auction" ? "auctions" : "products";

    const next = images.map((image) => {
      if (!isDataUrl(image)) return image;
      try {
        files += 1;
        return saveDataUrl(image, folder);
      } catch (err) {
        // An unsupported or corrupt payload keeps its old value rather than
        // losing the image entirely.
        console.warn(`  ! product ${row.id}: ${err.message} — left as-is`);
        files -= 1;
        return image;
      }
    });

    if (next.some((value, index) => value !== images[index])) {
      await pool.query("UPDATE products SET images = $1, updated_at = $2 WHERE id = $3", [
        JSON.stringify(next),
        Date.now(),
        row.id,
      ]);
      converted += 1;
    }
  }

  return { rows: converted, files };
}

async function migrateVendorProfiles() {
  const { rows } = await pool.query(
    "SELECT id, vendor_profile FROM users WHERE vendor_profile::text LIKE '%data:%'"
  );

  let converted = 0;
  let files = 0;

  for (const row of rows) {
    const profile = row.vendor_profile || {};
    const next = { ...profile };
    let changed = false;

    for (const field of PROFILE_IMAGE_FIELDS) {
      if (!isDataUrl(profile[field])) continue;
      try {
        next[field] = saveDataUrl(profile[field], "profiles");
        files += 1;
        changed = true;
      } catch (err) {
        console.warn(`  ! user ${row.id} ${field}: ${err.message} — left as-is`);
      }
    }

    if (changed) {
      await pool.query("UPDATE users SET vendor_profile = $1 WHERE id = $2", [
        JSON.stringify(next),
        row.id,
      ]);
      converted += 1;
    }
  }

  return { rows: converted, files };
}

async function migrate() {
  try {
    console.log("Running attachments migration (base64 → files)...");

    const products = await migrateProductImages();
    console.log(`  products: ${products.rows} row(s) rewritten, ${products.files} file(s) written`);

    const profiles = await migrateVendorProfiles();
    console.log(`  vendor profiles: ${profiles.rows} row(s) rewritten, ${profiles.files} file(s) written`);

    console.log("✅ Attachments migration complete.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
