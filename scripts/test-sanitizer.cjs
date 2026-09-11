// Regression tests for sanitizer.js, driven under jsdom so the REAL
// browser code path (DOMParser, TreeWalker) is exercised.
// Covers the bypass classes probed by PR #1's scratch tests plus ours:
// entity/control-char-obscured schemes, data:/vbscript:, event handlers,
// hostile style/srcset, dangerous elements, SVG edge cases.
// Run: npm test (also in CI).
const { JSDOM } = require("jsdom");

const dom = new JSDOM("", { url: "https://localhost/" });
globalThis.DOMParser = dom.window.DOMParser;
globalThis.NodeFilter = dom.window.NodeFilter;
globalThis.Node = dom.window.Node;

let failures = 0;
let passes = 0;

async function main() {
  await import("../sanitizer.js");
  const { sanitizePastedHtml } = globalThis;
  if (typeof sanitizePastedHtml !== "function") {
    throw new Error("sanitizer.js did not expose sanitizePastedHtml");
  }

  const check = (label, html, mustInclude = [], mustExclude = []) => {
    const out = sanitizePastedHtml(html);
    for (const s of mustInclude) {
      if (out.includes(s)) {
        passes++;
      } else {
        failures++;
        console.error(`FAIL - ${label}: missing ${JSON.stringify(s)} in ${JSON.stringify(out)}`);
      }
    }
    for (const s of mustExclude) {
      if (!out.toLowerCase().includes(s.toLowerCase())) {
        passes++;
      } else {
        failures++;
        console.error(`FAIL - ${label}: forbidden ${JSON.stringify(s)} in ${JSON.stringify(out)}`);
      }
    }
  };

  const BAD = ["<script", "javascript:", "vbscript:", "onerror", "onload", "onclick", "onfocus", "expression(", "-moz-binding", "behavior:"];

  // 1. Benign formatting survives
  check("benign formatting",
    `<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>`,
    ["<strong>world</strong>", 'href="https://example.com"'], BAD);
  check("relative links kept",
    `<p><a href="/path/page">a</a> <a href="#frag">b</a> <a href="mailto:x@y.z">c</a></p>`,
    ['href="/path/page"', 'href="#frag"', 'href="mailto:x@y.z"'], ["javascript:"]);

  // 2. Plain + case-variant javascript: URLs
  check("javascript href", `<p><a href="javascript:alert(1)">x</a></p>`, ["<p>"], ["href=", "javascript:"]);
  check("case variant", `<p><a href="JaVaScRiPt:alert(1)">x</a></p>`, [], ["href="]);
  check("leading whitespace/newlines", `<p><a href="&#x0A;&#x20;javascript:alert(1)">x</a></p>`, [], ["href="]);

  // 3. Entity + control-char obfuscation (the PR #1 bypass class)
  check("entity-encoded scheme", `<p><a href="j&#x09;avascript:alert(1)">x</a></p>`, [], ["href="]);
  check("entity-encoded letter", `<p><a href="&#106;avascript:alert(1)">x</a></p>`, [], ["href="]);
  check("tab inside scheme", `<p><a href="java\tscript:alert(1)">x</a></p>`, [], ["href="]);
  check("newline inside scheme", `<p><a href="java\nscript:alert(1)">x</a></p>`, [], ["href="]);
  check("null byte prefix", `<p><a href="\0javascript:alert(1)">x</a></p>`, [], ["href="]);
  check("img src javascript", `<p><img src="javascript:alert(1)"></p>`, [], ["src="]);

  // 4. data: / vbscript:
  check("data:text/html href blocked", `<p><a href="data:text/html,<h1>x</h1>">x</a></p>`, [], ["href=", "data:"]);
  check("data:image img src kept", `<p><img src="data:image/png;base64,iVBORw0KGgo="></p>`, ["data:image/png"], []);
  check("vbscript blocked", `<p><a href="vbscript:msgbox(1)">x</a></p>`, [], ["href="]);

  // 5. Event handlers (any case, any element incl. SVG)
  check("onerror stripped", `<p><img src="https://e.com/a.png" onerror="alert(1)"></p>`, ['src="https://e.com/a.png"'], ["onerror"]);
  check("svg onload stripped", `<p><svg onload="alert(1)"><circle r="5"/></svg></p>`, ["<svg", "<circle"], ["onload"]);
  check("svg script child removed", `<p><svg><script>alert(1)</script></svg></p>`, [], ["<script"]);

  // 6. style / srcset / use
  check("style expression removed", `<p style="width: expression(alert(1))">x</p>`, ["<p>x</p>"], ["style=", "expression("]);
  check("style behavior removed", `<p style="behavior:url(x.htc)">x</p>`, [], ["style="]);
  check("benign style also removed (strict)", `<p style="color: red">x</p>`, ["<p>x</p>"], ["style="]);
  check("srcset dropped, src kept", `<p><img src="https://e.com/a.png" srcset="javascript:alert(1)"></p>`, ['src="https://e.com/a.png"'], ["srcset"]);
  check("use remote href dropped", `<p><svg><use href="https://evil.com/x.svg#y"/></svg></p>`, [], ["evil.com"]);
  check("use fragment kept", `<p><svg><use href="#icon"/></svg></p>`, ['href="#icon"'], []);

  // 7. Dangerous elements gone entirely
  check("script/iframe/form/input removed",
    `<script>alert(1)</script><iframe src="https://e.com"></iframe><form><input value="x"></form><p>ok</p>`,
    ["<p>ok</p>"], ["<script", "<iframe", "<form", "<input"]);
  check("object/embed removed", `<object data="x"></object><embed src="y"><p>ok</p>`, ["<p>ok</p>"], ["<object", "<embed"]);

  // 8. Edge cases
  check("empty input", ``, [], []);
  check("contenteditable stripped", `<p contenteditable="true">x</p>`, ["<p>x</p>"], ["contenteditable"]);

  if (failures > 0) {
    console.error(`\n${failures} failing assertion(s), ${passes} passing.`);
    process.exit(1);
  }
  console.log(`\nAll sanitizer tests passed (${passes} assertions).`);
}

main().catch((err) => {
  console.error("test harness error:", err);
  process.exit(1);
});
