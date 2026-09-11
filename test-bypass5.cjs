const { JSDOM } = require("jsdom");
function checkBypass(html) {
  const dom = new JSDOM("");
  const parser = new dom.window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const el = doc.body.firstChild;
  if (!el || !el.attributes[0]) return;
  const val = el.attributes[0].value;

  // This removes URL encoding, unicode characters and more
  const decoded = decodeURIComponent(val).replace(/[\x00-\x20\s\n\r\t]/g, '').toLowerCase();

  console.log("val:", JSON.stringify(val));
  console.log("decoded:", JSON.stringify(decoded));
  console.log("regex:", /^javascript:/i.test(decoded));
  console.log("DOMPurify:", require("dompurify")(dom.window).sanitize(html));
}
checkBypass("<a href='j&#x00;avascript:alert(1)'>Test</a>");
checkBypass("<a href='j%0aavascript:alert(1)'>Test</a>");
checkBypass("<a href='java&#x09;script:alert(1)'>Test</a>");
checkBypass("<a href='&#x6A&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3A&#x61&#x6C&#x65&#x72&#x74&#x28&#x27&#x58&#x53&#x53&#x27&#x29'>Test</a>");
