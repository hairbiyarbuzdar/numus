/**
 * Small helpers shared by the listing endpoints (products, orders) that all
 * support search + filtering + paging. Kept in one place so the escaping and
 * parsing rules can't drift apart between routes.
 */

// `%`, `_` and `\` are wildcards/escapes in ILIKE — treat them as literals so a
// search for "50%" doesn't match everything.
function toLikePattern(term) {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Accepts epoch milliseconds (what the UI sends, so day boundaries follow the
 * user's own clock) or any date string Date.parse understands. Returns null for
 * "not supplied" and NaN for "supplied but unusable".
 */
function parseTimestamp(value) {
  if (value === undefined || value === null || value === "") return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return Math.trunc(asNumber);
  return Date.parse(value);
}

module.exports = { toLikePattern, parsePositiveInt, parseTimestamp };
