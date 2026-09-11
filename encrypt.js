// Text obfuscation toolkit (NOT secure encryption).
//
// CAVEAT: everything here is reversible-by-design obfuscation meant for
// playful hiding of text (spoilers, easter eggs), NOT for protecting
// secrets. ROT13/ROT47/Caesar/Atbash/Reverse are trivially breakable,
// Base64/Hex/Binary/URL are encodings (not encryption), and leet-speak
// decoding is approximate and lossy. Do not use for passwords, personal
// data, or anything that must stay confidential.

function rot13(text) {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function rot47(text) {
  return text.replace(/[!-~]/g, (c) => {
    const code = c.charCodeAt(0);
    return String.fromCharCode(33 + ((code - 33 + 47) % 94));
  });
}

function caesarShift(text, shift) {
  const k = ((Number(shift) || 0) % 26 + 26) % 26;
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + k) % 26) + base);
  });
}

function atbash(text) {
  return text.replace(/[a-zA-Z]/g, (c) => {
    if (c <= "Z") return String.fromCharCode(90 - (c.charCodeAt(0) - 65));
    return String.fromCharCode(122 - (c.charCodeAt(0) - 97));
  });
}

function reverseText(text) {
  return Array.from(text).reverse().join("");
}

function base64Encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

function base64Decode(text) {
  const bin = atob(text.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes, { fatal: true });
}

function hexEncode(text) {
  return Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexDecode(text) {
  const t = text.trim();
  if (t.length === 0) return "";
  if (t.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(t)) {
    throw new Error("Invalid hex input.");
  }
  const bytes = new Uint8Array(
    t.match(/../g).map((h) => parseInt(h, 16)),
  );
  return new TextDecoder().decode(bytes, { fatal: true });
}

function binaryEncode(text) {
  return Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(2).padStart(8, "0"))
    .join(" ");
}

function binaryDecode(text) {
  const t = text.trim();
  if (t.length === 0) return "";
  const bits = t.replace(/\s+/g, "");
  if (!/^[01]+$/.test(bits) || bits.length % 8 !== 0) {
    throw new Error("Invalid binary input.");
  }
  const bytes = new Uint8Array(
    bits.match(/.{8}/g).map((b) => parseInt(b, 2)),
  );
  return new TextDecoder().decode(bytes, { fatal: true });
}

const LEET_ENCODE_MAP = {
  a: "4",
  b: "8",
  e: "3",
  g: "9",
  i: "1",
  l: "1",
  o: "0",
  s: "5",
  t: "7",
};

const LEET_DECODE_MAP = {
  4: "a",
  8: "b",
  3: "e",
  9: "g",
  1: "i",
  0: "o",
  5: "s",
  7: "t",
};

function leetEncode(text) {
  return text.replace(/[abegilostABEGILOST]/g, (c) => {
    return LEET_ENCODE_MAP[c.toLowerCase()];
  });
}

// Best-effort only: digits may not have come from leet encoding,
// so decoding is approximate and lossy.
function leetDecode(text) {
  return text.replace(/[01345789]/g, (c) => {
    return LEET_DECODE_MAP[c] || c;
  });
}

// Registry driving the UI panel. `symmetric` methods use the same
// function both ways; `needsShift` methods read the Caesar shift input.
const EncryptMethods = {
  rot13: { name: "ROT13", encode: rot13, decode: rot13, symmetric: true },
  rot47: { name: "ROT47", encode: rot47, decode: rot47, symmetric: true },
  caesar: {
    name: "Caesar cipher",
    needsShift: true,
    encode: (s, k) => caesarShift(s, k),
    decode: (s, k) => caesarShift(s, 26 - (Number(k) || 0)),
  },
  atbash: { name: "Atbash", encode: atbash, decode: atbash, symmetric: true },
  reverse: {
    name: "Reverse",
    encode: reverseText,
    decode: reverseText,
    symmetric: true,
  },
  base64: { name: "Base64", encode: base64Encode, decode: base64Decode },
  hex: { name: "Hex", encode: hexEncode, decode: hexDecode },
  binary: { name: "Binary", encode: binaryEncode, decode: binaryDecode },
  url: {
    name: "URL encoding",
    encode: (s) => encodeURIComponent(s),
    decode: (s) => decodeURIComponent(s),
  },
  leet: {
    name: "Leet speak",
    encode: leetEncode,
    decode: leetDecode,
    lossyDecode: true,
  },
};

if (typeof window !== "undefined") {
  window.EncryptMethods = EncryptMethods;
}

function escapeHtmlForEncrypt(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function initEncryptPanel() {
  const panel = document.getElementById("encryptBar");
  const toggleBtn = document.getElementById("encryptBtn");
  const methodSelect = document.getElementById("encryptMethod");
  const modeSelect = document.getElementById("encryptMode");
  const shiftInput = document.getElementById("caesarShift");
  const shiftLabel = document.getElementById("caesarShiftLabel");
  const applyBtn = document.getElementById("encryptApply");
  const closeBtn = document.getElementById("encryptClose");
  const editorEl = document.getElementById("editor");
  if (!panel || !toggleBtn || !methodSelect || !applyBtn || !editorEl) return;

  if (methodSelect.options.length === 0) {
    for (const [id, m] of Object.entries(EncryptMethods)) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = m.name;
      methodSelect.appendChild(opt);
    }
  }

  function syncShiftVisibility() {
    const needsShift = !!EncryptMethods[methodSelect.value]?.needsShift;
    if (shiftInput) shiftInput.style.display = needsShift ? "" : "none";
    if (shiftLabel) shiftLabel.style.display = needsShift ? "" : "none";
  }

  toggleBtn.addEventListener("click", () => {
    panel.classList.toggle("visible");
  });
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      panel.classList.remove("visible");
    });
  }
  methodSelect.addEventListener("change", syncShiftVisibility);
  syncShiftVisibility();

  applyBtn.addEventListener("click", () => {
    const method = EncryptMethods[methodSelect.value];
    if (!method) return;
    const mode = modeSelect ? modeSelect.value : "encode";
    const shift = shiftInput ? shiftInput.value : 3;

    if (mode === "decode" && method.lossyDecode) {
      if (
        !confirm(
          "Leet-speak decoding is approximate and lossy. Continue anyway?",
        )
      ) {
        return;
      }
    }

    let targetMode = "document";
    let source = "";
    const sel = window.getSelection();
    if (
      sel &&
      !sel.isCollapsed &&
      editorEl.contains(sel.anchorNode) &&
      editorEl.contains(sel.focusNode)
    ) {
      targetMode = "selection";
      source = sel.toString();
    } else {
      source = editorEl.innerText || "";
    }
    if (!source) return;

    let result;
    try {
      result =
        mode === "decode"
          ? method.decode(source, shift)
          : method.encode(source, shift);
    } catch (err) {
      alert(`Could not decode: ${err.message || "invalid input."}`);
      return;
    }

    if (targetMode === "selection") {
      document.execCommand("insertText", false, result);
    } else {
      editorEl.innerHTML = result
        .split("\n")
        .map((line) =>
          line ? `<p>${escapeHtmlForEncrypt(line)}</p>` : "<p><br></p>",
        )
        .join("");
    }
    try {
      localStorage.setItem("markdownContent", editorEl.innerHTML);
    } catch (e) {
      // localStorage unavailable, continue anyway
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEncryptPanel);
  } else {
    initEncryptPanel();
  }
}
