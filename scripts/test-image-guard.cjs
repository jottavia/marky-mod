// Unit tests for image-guard.js: magic-byte classification of the
// image-size infinite-loop formats (ICNS, JPEG-XL, HEIF family).
// Pure logic, no dependencies beyond node:assert-level checks here.
// Run: node scripts/test-image-guard.cjs (also via npm test).
async function main() {
  const { blockedImageFormat, classifyDataUrl, extToMime } = await import(
    "../image-guard.js"
  );

  let pass = 0;
  let fail = 0;
  const ok = (cond, label, extra) => {
    if (cond) {
      pass++;
    } else {
      fail++;
      console.error(`FAIL - ${label}${extra ? " :: " + extra : ""}`);
    }
  };
  const B = (arr) => Uint8Array.from(arr);
  const str = (s) => Array.from(s).map((c) => c.charCodeAt(0));

  // Blocked formats
  ok(blockedImageFormat(B([...str("icns"), 0, 0, 1, 0])) === "icns", "icns magic");
  ok(blockedImageFormat(B([0xff, 0x0a, 0xd1, 0x0b])) === "jxl", "jxl raw codestream");
  const ftyp = (brand) => B([0, 0, 0, 24, ...str("ftyp"), ...str(brand), 0, 0, 0, 0]);
  for (const brand of ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1", "avif"]) {
    ok(blockedImageFormat(ftyp(brand)) === "heif", `heif brand ${brand}`);
  }
  ok(blockedImageFormat(ftyp("jxl ")) === "jxl", "jxl-in-iso-bmff brand");
  // Non-HEIF ftyp must pass (e.g. MP4 video)
  ok(blockedImageFormat(ftyp("isom")) === null, "mp4 ftyp passes through");
  ok(blockedImageFormat(ftyp("mp42")) === null, "mp42 ftyp passes through");

  // Safe formats pass through untouched
  ok(blockedImageFormat(B([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) === null, "png passes");
  ok(blockedImageFormat(B([0xff, 0xd8, 0xff, 0xe0])) === null, "jpeg passes");
  ok(blockedImageFormat(B([...str("GIF89a"), 1, 0])) === null, "gif passes");
  ok(blockedImageFormat(B([...str("BM"), 0, 0])) === null, "bmp passes");
  ok(blockedImageFormat(B([...str("RIFF"), 0, 0, 0, 0, ...str("WEBP")])) === null, "webp passes");
  ok(blockedImageFormat(B([...str("<svg xmlns"), 0, 0])) === null, "svg text passes");

  // Degenerate inputs never block (fail-open for availability)
  ok(blockedImageFormat(B([])) === null, "empty passes");
  ok(blockedImageFormat(B([1, 2])) === null, "short passes");
  ok(blockedImageFormat(null) === null, "null passes");
  ok(blockedImageFormat(B([0, 0, 0, 0])) === null, "zeros pass");

  // Data URLs
  const b64 = (bytes) => Buffer.from(bytes).toString("base64");
  ok(classifyDataUrl("data:image/png;base64," + b64([0x89, 0x50, 0x4e, 0x47])).format === null, "png data url passes");
  {
    const r = classifyDataUrl("data:image/icns;base64," + b64([...str("icns"), 1, 2, 3, 4]));
    ok(r.format === "icns" && r.undecodable === false, "icns data url blocked");
  }
  {
    const r = classifyDataUrl("data:image/svg+xml;utf8,<svg></svg>");
    ok(r.undecodable === true, "non-base64 data url flagged undecodable");
  }
  {
    const r = classifyDataUrl("data:image/png;base64,!!!");
    ok(r.undecodable === true, "bad base64 flagged undecodable");
  }

  // Extension -> MIME for local-file embedding
  ok(extToMime("photo.JPG") === "image/jpeg", "jpg extension case-insensitive");
  ok(extToMime("a/b/c.png?v=2") === "image/png", "query string ignored");
  ok(extToMime("icon.svg") === "image/svg+xml", "svg extension");
  ok(extToMime("noext") === null, "missing extension is null");
  ok(extToMime("file.weird") === null, "unknown extension is null");

  if (fail > 0) {
    console.error(`\n${fail} failing, ${pass} passing.`);
    process.exit(1);
  }
  console.log(`\nAll image-guard tests passed (${pass} assertions).`);
}

main().catch((err) => {
  console.error("test harness error:", err);
  process.exit(1);
});
