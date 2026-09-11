/**
 * Image pre-screening guard for md-to-docx.js.
 *
 * WHY THIS EXISTS: the pinned html-to-docx@1.8.0 bundles image-size@1.2.1,
 * whose ICNS, JPEG-XL, and HEIF parsers can loop forever on malicious
 * files (npm audit flags it; the only audit-sanctioned "fix" is a
 * ~30-release downgrade of html-to-docx, which was rejected as worse).
 * An npm override cannot help either: the vulnerable code is bundled
 * inside html-to-docx's dist, not loaded from node_modules.
 *
 * WHAT IT DOES: classifies image bytes by magic number and reports the
 * formats with known-infinite-loop parsers. md-to-docx.js removes those
 * images BEFORE html-to-docx (and its bundled image-size) ever sees
 * them, which cuts the vulnerable parsers out of reach while keeping
 * html-to-docx@1.8.0. Safe formats (PNG, JPEG, GIF, BMP, WebP, SVG, …)
 * and unrecognized bytes pass through untouched.
 *
 * Pure bytes-in/string-out module: no fs, no network, no DOM — so it is
 * directly unit-testable (scripts/test-image-guard.cjs).
 */

const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "avif",
  "jxl ",
]);

function ascii(bytes, off, len) {
  let s = "";
  for (let i = 0; i < len; i++) {
    const b = bytes[off + i];
    if (b === undefined) return null;
    s += String.fromCharCode(b);
  }
  return s;
}

/**
 * Classify image bytes by magic number.
 * @param {Uint8Array|Buffer} bytes - leading bytes (12+ recommended)
 * @returns {"icns"|"jxl"|"heif"|null} blocked format, or null when the
 *   bytes are not a blocked format (safe or unrecognized → passthrough).
 */
export function blockedImageFormat(bytes) {
  if (!bytes || bytes.length < 4) return null;

  // Apple ICNS: "icns" at offset 0.
  if (ascii(bytes, 0, 4) === "icns") return "icns";

  // JPEG-XL raw codestream signature: FF 0A.
  if (bytes[0] === 0xff && bytes[1] === 0x0a) return "jxl";

  // ISO Base Media File Format: "ftyp" at offset 4, brand at 8.
  // Covers HEIF/HEIC/HEVC/AVIF and the ftyp-wrapped JPEG-XL variant.
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand && HEIF_BRANDS.has(brand)) {
      return brand === "jxl " ? "jxl" : "heif";
    }
  }

  return null;
}

/**
 * Decode just enough of a base64 data-URL payload to classify it
 * (first 96 bytes; magic numbers live in the first 12).
 * Returns null when undecodable (caller passes through + warns).
 */
export function classifyDataUrl(src) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(String(src || ""));
  if (!m || m[2] !== ";base64") return { format: null, undecodable: true };
  try {
    const raw = m[3].replace(/\s+/g, "").slice(0, 128);
    const buf = Buffer.from(raw, "base64");
    if (buf.length < 4) return { format: null, undecodable: true };
    return { format: blockedImageFormat(buf), undecodable: false };
  } catch {
    return { format: null, undecodable: true };
  }
}

const EXT_TO_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

/**
 * MIME type by file extension (lowercased, dot optional).
 * Returns null for unknown extensions.
 */
export function extToMime(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(String(filename || "").split(/[?#]/)[0]);
  if (!m) return null;
  return EXT_TO_MIME[m[1].toLowerCase()] || null;
}
