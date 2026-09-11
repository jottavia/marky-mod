const { JSDOM } = require("jsdom");
function checkBypass(html) {
  const dom = new JSDOM("");
  const parser = new dom.window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const el = doc.body.firstChild;
  const attr = el.attributes[0];
  const val = attr.value;

  // Try to parse javascript protocol
  const decoded = val.replace(/[\x00-\x20\s\n\r\t]/g, '');
  console.log("val:", JSON.stringify(val));
  console.log("decoded:", JSON.stringify(decoded));
  console.log("regex:", /^\s*javascript:/i.test(decoded));
}
checkBypass("<a href='j&#x00;avascript:alert(1)'>Test</a>");
checkBypass("<a href='\x01javascript:alert(1)'>Test</a>");
