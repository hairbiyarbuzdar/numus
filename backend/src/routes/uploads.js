const express = require("express");
const { requireRole } = require("../middleware/auth");
const { saveDataUrl, toAbsoluteUrl, ALLOWED_FOLDERS } = require("../utils/storage");

const router = express.Router();

/**
 * POST /uploads
 * Body: { file: "data:image/png;base64,...", folder?: "products" }
 *   or: { files: [ ... ], folder?: "products" }
 *
 * Writes the file to disk and returns its URL. The caller stores the URL — the
 * encoded bytes never go into the database.
 *
 * Takes a data URL rather than multipart because the browser side already reads
 * files with FileReader; that keeps this dependency-free. Worth revisiting if
 * uploads grow, since base64 costs ~33% over the wire.
 */
router.post("/", requireRole("vendor", "buyer", "superAdmin"), async (req, res) => {
  try {
    const { file, files, folder } = req.body;
    const input = files || (file ? [file] : []);

    if (!input.length) {
      return res.status(400).json({ message: "No file supplied" });
    }
    if (input.length > 10) {
      return res.status(400).json({ message: "At most 10 files per request" });
    }
    if (folder !== undefined && !ALLOWED_FOLDERS.includes(folder)) {
      return res.status(400).json({ message: `folder must be one of: ${ALLOWED_FOLDERS.join(", ")}` });
    }

    const urls = input.map((entry) => toAbsoluteUrl(req, saveDataUrl(entry, folder)));

    res.status(201).json({ urls, url: urls[0] });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error("POST /uploads error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

module.exports = router;
