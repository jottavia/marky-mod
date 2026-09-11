const { JSDOM } = require("jsdom");
function checkBypass(html) {
  const dom = new JSDOM("");
  const parser = new dom.window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  if (!doc || !doc.body) return "";

  const val = doc.body.firstChild.attributes[0].value;

  // The current regex is:
  const isJS = /^\s*javascript:/i.test(val);

  console.log("html:", html);
  console.log("val:", JSON.stringify(val));
  console.log("isJS:", isJS);
}
checkBypass("<a href='j&#x09;avascript:alert(1)'>Test</a>");
checkBypass("<a href='\x01javascript:alert(1)'>Test</a>");
checkBypass("<a href='java\nscript:alert(1)'>Test</a>");
checkBypass("<a href='&#14;javascript:alert(1)'>Test</a>");
