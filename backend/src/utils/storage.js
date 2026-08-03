const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * File storage for uploaded images and vendor documents.
 *
 * Files live on disk and the database stores only their URL — previously the
 * base64 data URL itself was written into the row, which bloats every query
 * that touches the record.
 *
 * They are served from `/api/uploads/...`, which the existing Nginx config
 * already proxies to this backend, so nothing needs to change on the server.
 */

const UPLOAD_ROOT =
  process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "..", "uploads");

const PUBLIC_PREFIX = "/api/uploads";

// Only formats we are willing to serve back. Anything else is rejected rather
// than written to disk under a guessed extension.
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

// Keeps one vendor's documents from being written next to product images, and
// bounds how many files land in a single directory.
const ALLOWED_FOLDERS = ["products", "auctions", "profiles", "misc"];

const MAX_BYTES = 5 * 1024 * 1024;

/** Parses a `data:<mime>;base64,<payload>` URL. Returns null if it isn't one. */
function parseDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.*)$/s.exec(value.trim());
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), base64: match[2] };
}

function isDataUrl(value) {
  return parseDataUrl(value) !== null;
}

/** True for something already usable as a URL — ours, or an external one. */
function isStoredUrl(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.startsWith(PUBLIC_PREFIX) || /^(https?:)?\/\//i.test(trimmed);
}

function ensureDir(folder) {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Writes a base64 data URL to disk and returns its public URL.
 * Throws an Error with a `.status` for anything the caller sent wrong.
 */
function saveDataUrl(dataUrl, folder = "misc") {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    const err = new Error("Expected a base64 data URL");
    err.status = 400;
    throw err;
  }

  const extension = ALLOWED_TYPES[parsed.mimeType];
  if (!extension) {
    const err = new Error(
      `Unsupported file type: ${parsed.mimeType}. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "misc";
  const buffer = Buffer.from(parsed.base64, "base64");

  if (!buffer.length) {
    const err = new Error("File is empty");
    err.status = 400;
    throw err;
  }
  if (buffer.length > MAX_BYTES) {
    const err = new Error(`File is larger than ${MAX_BYTES / 1024 / 1024}MB`);
    err.status = 413;
    throw err;
  }

  // Random name: the original filename is attacker-controlled and never needs
  // to survive, and this avoids collisions without a lookup.
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const dir = ensureDir(safeFolder);
  fs.writeFileSync(path.join(dir, fileName), buffer);

  return `${PUBLIC_PREFIX}/${safeFolder}/${fileName}`;
}

/**
 * Removes a file we stored, given the URL held in the database. External URLs
 * and anything outside the upload root are ignored, and a missing file is not
 * an error — the caller is deleting it either way.
 */
function deleteStoredFile(value) {
  if (typeof value !== "string") return false;

  const index = value.indexOf(PUBLIC_PREFIX);
  if (index === -1) return false;

  const relative = value.slice(index + PUBLIC_PREFIX.length).replace(/^\/+/, "");
  if (!relative) return false;

  const target = path.resolve(UPLOAD_ROOT, relative);
  // Never follow a path that climbs out of the upload directory.
  if (!target.startsWith(path.resolve(UPLOAD_ROOT))) return false;

  try {
    fs.unlinkSync(target);
    return true;
  } catch {
    return false;
  }
}

/** Absolute URL for a stored path, based on the request that asked for it. */
function toAbsoluteUrl(req, storedPath) {
  if (!storedPath.startsWith(PUBLIC_PREFIX)) return storedPath;
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${base.replace(/\/$/, "")}${storedPath}`;
}

module.exports = {
  UPLOAD_ROOT,
  PUBLIC_PREFIX,
  ALLOWED_TYPES,
  ALLOWED_FOLDERS,
  MAX_BYTES,
  parseDataUrl,
  isDataUrl,
  isStoredUrl,
  saveDataUrl,
  deleteStoredFile,
  toAbsoluteUrl,
};
