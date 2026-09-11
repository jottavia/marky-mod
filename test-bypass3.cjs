const { JSDOM } = require("jsdom");
function checkBypass(html) {
  const dom = new JSDOM("");
  const parser = new dom.window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const el = doc.body.firstChild;
  const attr = el.attributes[0];
  const val = attr.value;
  console.log("html:", html);
  console.log("val:", JSON.stringify(val));
}
checkBypass("<a href='j\0avascript:alert(1)'>Test</a>");
checkBypass("<a href='j\x01avascript:alert(1)'>Test</a>");
checkBypass("<a href='j&#x00;avascript:alert(1)'>Test</a>");
