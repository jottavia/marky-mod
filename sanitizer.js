// Paste sanitizer: strips executable and junk markup from pasted HTML so
// web content can't bring scripts, event handlers, or hostile URLs into
// the editor. Formatting tags (p, h1-h6, ul/ol, a, img, table, etc.)
// pass through.
//
// Design notes (all verified by scripts/test-sanitizer.cjs):
// - DOMParser decodes HTML entities BEFORE we inspect attributes, so
//   checks run on the decoded value (e.g. j&#x09;avascript: arrives as
//   j<TAB>avascript:). Control characters are stripped before any
//   protocol test, closing that bypass class.
// - data: and vbscript: URLs are blocked alongside javascript:.
//   data:image/video/audio is allowed on media `src` (inert contexts);
//   data: is blocked everywhere else (top-level navigation executes it).
// - `style` attributes are removed entirely: CSS blacklist filtering
//   (expression, -moz-binding, etc.) is bypassable via comments and
//   encoding tricks, and markdown has no use for inline styles.
// - `srcset` is dropped (it can smuggle javascript: URLs); `src` stays.
// - http(s) `use` hrefs are dropped (external fetch on paste).
// - This file defines pure functions of its DOM globals so Node tests
//   can drive it under jsdom (see scripts/test-sanitizer.cjs).

function sanitizeUrl(value, kind) {
  // value is post-entity-decode; strip ASCII controls/whitespace that
  // browsers ignore inside schemes ("java\tscript:", "&#x09;" forms).
  // U+FFFD is included because HTML parsers (spec-mandated) replace NUL
  // bytes with it before we ever see the attribute.
  const compact = String(value).replace(/[\x00-\x20\uFFFD]+/g, "");
  const lower = compact.toLowerCase();
  const schemeMatch = lower.match(/^([a-z0-9+.-]+):/);
  const scheme = schemeMatch ? schemeMatch[1] : "";

  if (scheme === "javascript" || scheme === "vbscript") return null;

  if (scheme === "data") {
    // Only media payloads in media attributes; never in navigation.
    if (kind !== "media") return null;
    const mediatype = lower.slice(5).split(";")[0].split(",")[0];
    if (
      mediatype.startsWith("image/") ||
      mediatype.startsWith("video/") ||
      mediatype.startsWith("audio/")
    ) {
      return value;
    }
    return null;
  }

  return value;
}

function sanitizePastedHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  if (!doc || !doc.body) return "";

  doc
    .querySelectorAll(
      "script, style, iframe, object, embed, link, meta, base, form, " +
        "input, button, textarea, select, option, noscript, template, " +
        "slot, canvas, audio, video, source, track, frame, frameset, applet",
    )
    .forEach((el) => el.remove());

  const elements = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) elements.push(walker.currentNode);

  for (const el of elements) {
    const tag = (el.tagName || "").toLowerCase();
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if (name === "style") {
        el.removeAttribute(attr.name);
      } else if (name === "srcset") {
        el.removeAttribute(attr.name);
      } else if (name === "href" || name === "xlink:href") {
        const kind = tag === "use" ? "media" : "nav";
        if (kind === "media") {
          // Same-document fragment refs are fine; block remote fetches.
          const v = String(attr.value).replace(/[\x00-\x20\uFFFD]+/g, "");
          if (/^https?:/i.test(v)) {
            el.removeAttribute(attr.name);
            continue;
          }
        }
        const clean = sanitizeUrl(attr.value, kind);
        if (clean === null) el.removeAttribute(attr.name);
      } else if (name === "src" || name === "poster") {
        const clean = sanitizeUrl(attr.value, "media");
        if (clean === null) el.removeAttribute(attr.name);
      } else if (name === "action" || name === "formaction") {
        el.removeAttribute(attr.name);
      } else if (name === "background") {
        el.removeAttribute(attr.name);
      }
    }
    el.removeAttribute("contenteditable");
  }

  return doc.body.innerHTML;
}

if (typeof globalThis !== "undefined") {
  globalThis.sanitizePastedHtml =
    globalThis.sanitizePastedHtml || sanitizePastedHtml;
  globalThis.sanitizeUrl = globalThis.sanitizeUrl || sanitizeUrl;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { sanitizePastedHtml, sanitizeUrl };
}
