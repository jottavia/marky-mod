// Repo health checks: run with `npm run check` (and in CI).
// Fails (non-zero exit) if any check fails.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const failures = [];

function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`FAIL - ${name}: ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// 1. All browser JS files must parse.
check("node --check on JS files", () => {
  const files = [
    "app.js",
    "renderers.js",
    "theme-manager.js",
    "format-bar.js",
    "encrypt.js",
    "real-crypto.js",
    "page-setup.js",
    "html-export.js",
    "pdf-export.js",
    "docx-export.js",
    "default-content.js",
    "md-to-docx.js",
  ];
  for (const f of files) {
    execSync(`node --check ${f}`, { cwd: root, stdio: "pipe" });
  }
});

// 2. Theme parity: ThemeManager ids == index.html allow-list,
//    and every non-light theme has a CSS block.
check("theme parity (manager / html / css)", () => {
  const tm = read("theme-manager.js");
  const css = read("app.css");
  const html = read("index.html");

  const tmIds = [...tm.matchAll(/id:\s*"([a-z-]+)"/g)].map((m) => m[1]);
  const cssIds = [
    ...new Set(
      [...css.matchAll(/\[data-theme="([a-z-]+)"\]/g)].map((m) => m[1]),
    ),
  ];
  const allowBlock = html.match(/var validThemes = \[([\s\S]*?)\];/);
  assert(allowBlock, "validThemes allow-list not found in index.html");
  const htmlIds = [...allowBlock[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);

  assert(tmIds.length > 2, "expected more than light/dark themes");
  for (const id of tmIds) {
    assert(htmlIds.includes(id), `theme "${id}" missing from index.html allow-list`);
    if (id !== "light") {
      assert(cssIds.includes(id), `theme "${id}" missing CSS [data-theme] block`);
    }
  }
  for (const id of cssIds) {
    assert(tmIds.includes(id), `CSS theme "${id}" unknown to ThemeManager`);
  }
  assert(/id="themeSelect"/.test(html), "#themeSelect missing from index.html");
});

// 3. Export parity: the standalone HTML export must carry theme support.
check("html-export theme parity", () => {
  const exp = read("html-export.js");
  assert(
    exp.includes('fetch("theme-manager.js")'),
    'export does not fetch /theme-manager.js',
  );
  assert(
    /await themeManagerRes\.text\(\)/.test(exp),
    "export does not embed theme-manager.js content",
  );
  assert(exp.includes('id="themeSelect"'), "export toolbar lacks #themeSelect");
  assert(exp.includes('id="themeToggle"'), "export toolbar lacks #themeToggle");
  assert(
    exp.includes('data-theme="${currentTheme}"'),
    "export <html> does not carry the current data-theme",
  );
  assert(
    exp.includes('fetch("encrypt.js")'),
    'export does not fetch /encrypt.js',
  );
  assert(
    /await encryptRes\.text\(\)/.test(exp),
    "export does not embed encrypt.js content",
  );
  assert(exp.includes('id="encryptBtn"'), "export toolbar lacks #encryptBtn");
  assert(exp.includes('id="encryptBar"'), "export lacks #encryptBar panel");
  assert(
    exp.includes('fetch("real-crypto.js")'),
    'export does not fetch /real-crypto.js',
  );
  assert(
    /await realCryptoRes\.text\(\)/.test(exp),
    "export does not embed real-crypto.js content",
  );
  assert(exp.includes('id="rcMethod"'), "export lacks #rcMethod");
  assert(exp.includes('id="rcPassword"'), "export lacks #rcPassword");
  assert(exp.includes('id="rcEncryptBtn"'), "export lacks #rcEncryptBtn");
  assert(exp.includes('id="rcDecryptBtn"'), "export lacks #rcDecryptBtn");
  assert(exp.includes('id="docxBtn"'), "export toolbar lacks #docxBtn");
  assert(
    exp.includes('fetch("docx-export.js")'),
    "export does not fetch /docx-export.js",
  );
  assert(
    /await docxExportRes\.text\(\)/.test(exp),
    "export does not embed docx-export.js content",
  );
  assert(
    exp.includes("unpkg.com/docx@7.1.0"),
    "export lacks docx CDN script",
  );
  assert(
    exp.includes("FileSaver.js/2.0.5/FileSaver.min.js"),
    "export lacks FileSaver CDN script",
  );
});

// 4. Paste sanitizer present and wired into the paste handler.
check("paste sanitizer", () => {
  const app = read("app.js");
  assert(/function sanitizePastedHtml/.test(app), "sanitizePastedHtml missing");
  assert(
    /sanitizePastedHtml\(html\)/.test(app),
    "paste handler does not use sanitizePastedHtml",
  );
  for (const token of ["script", "startsWith(\"on\")", "javascript:"]) {
    assert(app.includes(token), `sanitizer does not handle ${token}`);
  }
});

// 5. Obfuscation toolkit: all methods present, disclaimer present,
//    panel wired into index.html with matching IDs.
check("obfuscation toolkit", () => {
  const enc = read("encrypt.js");
  const html = read("index.html");
  for (const m of [
    "rot13",
    "rot47",
    "caesar",
    "atbash",
    "reverse",
    "base64",
    "hex",
    "binary",
    "url",
    "leet",
  ]) {
    assert(
      enc.includes(`${m}:`) || enc.includes(`function ${m}`),
      `obfuscation method "${m}" missing from encrypt.js`,
    );
  }
  assert(
    /NOT secure encryption/.test(enc),
    "security disclaimer missing from encrypt.js",
  );
  for (const id of [
    'id="encryptBtn"',
    'id="encryptBar"',
    'id="encryptMethod"',
    'id="encryptMode"',
    'id="caesarShift"',
    'id="encryptApply"',
    'id="encryptClose"',
  ]) {
    assert(html.includes(id), `${id} missing from index.html`);
  }
  assert(
    html.includes('<script src="./encrypt.js"></script>'),
    "encrypt.js not loaded in index.html",
  );
  const css = read("app.css");
  assert(css.includes(".encrypt-bar"), ".encrypt-bar styles missing from app.css");
});

// 6. Real encryption: all 10 algorithms registered, untested-use-at-own-risk
//    labeling present, panel wired into index.html and the export.
check("real encryption", () => {
  const rc = read("real-crypto.js");
  const html = read("index.html");
  const exp = read("html-export.js");
  for (const id of [
    "aes-gcm",
    "aes-cbc",
    "aes-cbc-pure",
    "chacha20",
    "rabbit",
    "speck",
    "xtea",
    "xxtea",
    "trivium",
    "rc4",
  ]) {
    assert(
      rc.includes(`id: "${id}"`),
      `algorithm "${id}" missing from real-crypto.js registry`,
    );
  }
  assert(
    /SECURITY UNTESTED/.test(rc),
    "untested-use-at-own-risk disclaimer missing from real-crypto.js",
  );
  for (const id of [
    'id="rcMethod"',
    'id="rcPassword"',
    'id="rcEncryptBtn"',
    'id="rcDecryptBtn"',
  ]) {
    assert(html.includes(id), `${id} missing from index.html`);
    assert(exp.includes(id), `${id} missing from html-export.js`);
  }
  assert(
    html.includes('<script src="./real-crypto.js"></script>'),
    "real-crypto.js not loaded in index.html",
  );
  const css = read("app.css");
  assert(css.includes(".encrypt-danger"), ".encrypt-danger styles missing from app.css");
});

// 7. Page setup: Letter default with 1-inch margins, panel wired into
//    index.html and the export, honored by PDF and DOCX exporters.
check("page setup", () => {
  const ps = read("page-setup.js");
  const html = read("index.html");
  const exp = read("html-export.js");
  assert(
    ps.includes('DEFAULT_PAGE_SIZE_ID = "letter"'),
    "default page size is not letter",
  );
  for (const id of ["letter", "legal", "tabloid", "a4", "a5"]) {
    assert(ps.includes(`${id}:`), `page size "${id}" missing from page-setup.js`);
  }
  const letter = ps.match(/letter:\s*\{([^}]+)\}/);
  assert(letter, "letter size block not found");
  for (const dim of ["wIn: 8.5", "hIn: 11", "wTwips: 12240", "hTwips: 15840"]) {
    assert(letter[1].includes(dim), `letter dimensions wrong (missing ${dim})`);
  }
  assert(
    /top: 1, right: 1, bottom: 1, left: 1/.test(ps),
    "default margins are not 1 inch",
  );
  for (const id of [
    'id="pageSetupBtn"',
    'id="pageSetupBar"',
    'id="pageSizeSelect"',
    'id="marginTopInput"',
    'id="marginRightInput"',
    'id="marginBottomInput"',
    'id="marginLeftInput"',
    'id="pageSetupClose"',
  ]) {
    assert(html.includes(id), `${id} missing from index.html`);
    assert(exp.includes(id), `${id} missing from html-export.js`);
  }
  assert(
    html.includes('<script src="./page-setup.js"></script>'),
    "page-setup.js not loaded in index.html",
  );
  assert(
    exp.includes('fetch("page-setup.js")'),
    "export does not fetch /page-setup.js",
  );
  assert(
    /await pageSetupRes\.text\(\)/.test(exp),
    "export does not embed page-setup.js content",
  );
  const css = read("app.css");
  assert(css.includes(".page-setup-bar"), ".page-setup-bar styles missing from app.css");
  const pdf = read("pdf-export.js");
  assert(pdf.includes("PageSetup"), "pdf-export.js does not honor PageSetup");
  assert(
    !/format: "a4"/.test(pdf),
    "pdf-export.js still hardcodes A4",
  );
  const docx = read("docx-export.js");
  assert(docx.includes("PageSetup"), "docx-export.js does not honor PageSetup");
  assert(
    docx.includes("setup.size.wTwips"),
    "docx-export.js does not set page size from PageSetup",
  );
});

// 8. Welcome copy: default-content.js and the index.html static block stay
//    in sync on the default-doc markers app.js depends on, and document
//    the shipped features. GitHub entry points at the fork.
check("welcome copy", () => {
  const dc = read("default-content.js");
  const html = read("index.html");
  const app = read("app.js");
  for (const marker of ["👋 Welcome to Markey-Mod", "Quick Start"]) {
    assert(dc.includes(marker), `default-content.js missing marker ${marker}`);
    assert(html.includes(marker), `index.html static block missing marker ${marker}`);
    assert(app.includes(marker), `app.js detection missing marker ${marker}`);
  }
  for (const keyword of [
    "22 themes",
    "Obfuscate",
    "MK2$",
    "SECURITY UNTESTED",
    "Page setup",
    "Letter",
  ]) {
    assert(
      dc.toLowerCase().includes(keyword.toLowerCase()),
      `default-content.js does not mention ${keyword}`,
    );
  }
  assert(
    html.includes("https://github.com/jottavia/marky-mod"),
    "index.html GitHub button does not point at the fork",
  );
  const exp = read("html-export.js");
  assert(
    exp.includes("https://github.com/jottavia/marky-mod"),
    "export GitHub button does not point at the fork",
  );
});

// 9. Portable paths: local assets use relative URLs so the app works from
//    any base path (Firebase root, GitHub Pages /marky-mod/ subpath,
//    localhost). No root-absolute local refs in page, export, manifest.
check("portable paths", () => {
  const html = read("index.html");
  const exp = read("html-export.js");
  const manifest = read("manifest.json");
  const rootAbsolute = /((href|src)=["']\/|fetch\(["']\/|"src":\s*"\/"|"start_url":\s*"\/*\")/;
  for (const [name, content] of [
    ["index.html", html],
    ["html-export.js", exp],
    ["manifest.json", manifest],
  ]) {
    const m = content.match(rootAbsolute);
    assert(!m, `${name} has root-absolute local ref: ${m && m[0]}`);
  }
  assert(
    html.includes('href="./app.css"'),
    "index.html does not load app.css relatively",
  );
  assert(
    exp.includes('fetch("app.css")'),
    "export does not fetch app.css relatively",
  );
  assert(
    manifest.includes('"start_url": "./"'),
    "manifest start_url is not relative",
  );
  assert(
    fs.existsSync(path.join(root, ".nojekyll")),
    ".nojekyll missing (needed for GitHub Pages)",
  );
});

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
