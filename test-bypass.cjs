const { JSDOM } = require("jsdom");

function checkBypass(html) {
  const dom = new JSDOM("");
  const parser = new dom.window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const el = doc.body.firstChild;
  const attr = el.attributes[0];
  const val = attr.value;
  console.log("val:", JSON.stringify(val));
  console.log("regex 1:", /^\s*javascript:/i.test(val));
  console.log("regex 2:", /^\s*javascript:/i.test(val.replace(/[\x00-\x20]/g, '')));
}

checkBypass("<a href='j&#x09;avascript:alert(1)'>Test</a>");
checkBypass("<a href='java\0script:alert(1)'>Test</a>");
