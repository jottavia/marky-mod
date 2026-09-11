const { JSDOM } = require("jsdom");

function sanitizePastedHtml(html) {
  const dom = new JSDOM("");
  const parser = new dom.window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  if (!doc || !doc.body) return "";

  doc
    .querySelectorAll(
      "script, style, iframe, object, embed, link, meta, base, form, " +
        "input, button, textarea, select, option, noscript, template, " +
        "slot, canvas, audio, video, source, track, frame, frameset, applet",
    )
    .forEach((el) => el.remove());

  const elements = [];
  const walker = doc.createTreeWalker(doc.body, dom.window.NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) elements.push(walker.currentNode);

  for (const el of elements) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if (
        (name === "href" || name === "src" || name === "xlink:href") &&
        /^\s*javascript:/i.test(attr.value.replace(/[\x00-\x20]/g, ''))
      ) {
        el.removeAttribute(attr.name);
      } else if (name === "style") {
        el.setAttribute(
          attr.name,
          attr.value
            .replace(/expression\s*\(/gi, "")
            .replace(/javascript\s*:/gi, "")
            .replace(/behaviour\s*:/gi, "")
            .replace(/behavior\s*:/gi, ""),
        );
      }
    }
    el.removeAttribute("contenteditable");
  }

  return doc.body.innerHTML;
}
console.log(sanitizePastedHtml("<b style='width: e\\xpression(alert(1))'>Test</b>"));
console.log(sanitizePastedHtml("<b style='color: j\\avascript:alert(1)'>Test</b>"));
