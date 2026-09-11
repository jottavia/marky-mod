const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

function sanitizePastedHtml(html) {
  return DOMPurify.sanitize(html);
}

console.log(sanitizePastedHtml("<a href='\x01javascript:alert(1)'>Test</a>"));
console.log(sanitizePastedHtml("<a href='java\nscript:alert(1)'>Test</a>"));
console.log(sanitizePastedHtml("<a href='j&#x0a;avascript:alert(1)'>Test</a>"));
