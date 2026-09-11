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
    exp.includes('fetch("/theme-manager.js")'),
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
    exp.includes('fetch("/encrypt.js")'),
    'export does not fetch /encrypt.js',
  );
  assert(
    /await encryptRes\.text\(\)/.test(exp),
    "export does not embed encrypt.js content",
  );
  assert(exp.includes('id="encryptBtn"'), "export toolbar lacks #encryptBtn");
  assert(exp.includes('id="encryptBar"'), "export lacks #encryptBar panel");
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
    html.includes('<script src="/encrypt.js"></script>'),
    "encrypt.js not loaded in index.html",
  );
  const css = read("app.css");
  assert(css.includes(".encrypt-bar"), ".encrypt-bar styles missing from app.css");
});

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
