// Shared page setup for PDF and DOCX exports.
//
// Defaults: US Letter (8.5 x 11 in) with 1-inch margins on all sides.
// The panel (index.html #pageSetupBar, mirrored in html-export.js)
// persists choices to localStorage. Exporters read the live controls
// via getPageSetup(), so exports always honor what the panel shows.

const PAGE_SIZES = {
  letter: {
    name: "Letter (8.5 × 11 in)",
    wIn: 8.5,
    hIn: 11,
    wMm: 215.9,
    hMm: 279.4,
    wTwips: 12240,
    hTwips: 15840,
    jspdf: "letter",
  },
  legal: {
    name: "Legal (8.5 × 14 in)",
    wIn: 8.5,
    hIn: 14,
    wMm: 215.9,
    hMm: 355.6,
    wTwips: 12240,
    hTwips: 20160,
    jspdf: "legal",
  },
  tabloid: {
    name: "Tabloid (11 × 17 in)",
    wIn: 11,
    hIn: 17,
    wMm: 279.4,
    hMm: 431.8,
    wTwips: 15840,
    hTwips: 24480,
    jspdf: "tabloid",
  },
  a4: {
    name: "A4 (210 × 297 mm)",
    wIn: 210 / 25.4,
    hIn: 297 / 25.4,
    wMm: 210,
    hMm: 297,
    wTwips: 11906,
    hTwips: 16838,
    jspdf: "a4",
  },
  a5: {
    name: "A5 (148 × 210 mm)",
    wIn: 148 / 25.4,
    hIn: 210 / 25.4,
    wMm: 148,
    hMm: 210,
    wTwips: 8391,
    hTwips: 11906,
    jspdf: "a5",
  },
};

const DEFAULT_PAGE_SIZE_ID = "letter";
const DEFAULT_MARGINS_IN = { top: 1, right: 1, bottom: 1, left: 1 };
const PAGE_SETUP_SIZE_KEY = "marky-page-size";
const PAGE_SETUP_MARGINS_KEY = "marky-page-margins";

function clampMargin(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(3, Math.max(0, n));
}

// Read the live panel controls (falling back to persisted values,
// then to defaults), and normalize so content always keeps at least
// a 1-inch live area in each dimension.
function getPageSetup() {
  let sizeId = DEFAULT_PAGE_SIZE_ID;
  let margins = { ...DEFAULT_MARGINS_IN };
  try {
    const storedSize = localStorage.getItem(PAGE_SETUP_SIZE_KEY);
    if (storedSize && PAGE_SIZES[storedSize]) sizeId = storedSize;
    const storedMargins = JSON.parse(
      localStorage.getItem(PAGE_SETUP_MARGINS_KEY) || "null",
    );
    if (storedMargins && typeof storedMargins === "object") {
      for (const side of ["top", "right", "bottom", "left"]) {
        margins[side] = clampMargin(
          storedMargins[side],
          DEFAULT_MARGINS_IN[side],
        );
      }
    }
  } catch (e) {
    // localStorage unavailable; defaults stand
  }

  if (typeof document !== "undefined") {
    const sizeSelect = document.getElementById("pageSizeSelect");
    if (sizeSelect && PAGE_SIZES[sizeSelect.value]) {
      sizeId = sizeSelect.value;
    }
    const inputs = {
      top: document.getElementById("marginTopInput"),
      right: document.getElementById("marginRightInput"),
      bottom: document.getElementById("marginBottomInput"),
      left: document.getElementById("marginLeftInput"),
    };
    for (const side of Object.keys(inputs)) {
      if (inputs[side] && inputs[side].value !== "") {
        margins[side] = clampMargin(inputs[side].value, margins[side]);
      }
    }
  }

  const size = PAGE_SIZES[sizeId] || PAGE_SIZES[DEFAULT_PAGE_SIZE_ID];
  // Guarantee at least 1 inch of live area; shrink right/bottom first.
  if (margins.left + margins.right > size.wIn - 1) {
    margins.right = Math.max(0, size.wIn - 1 - margins.left);
  }
  if (margins.top + margins.bottom > size.hIn - 1) {
    margins.bottom = Math.max(0, size.hIn - 1 - margins.top);
  }
  return { sizeId, size, margins };
}

function initPageSetupPanel() {
  const panel = document.getElementById("pageSetupBar");
  const toggleBtn = document.getElementById("pageSetupBtn");
  const sizeSelect = document.getElementById("pageSizeSelect");
  const closeBtn = document.getElementById("pageSetupClose");
  if (!panel || !sizeSelect) return;

  if (sizeSelect.options.length === 0) {
    for (const [id, s] of Object.entries(PAGE_SIZES)) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = s.name;
      sizeSelect.appendChild(opt);
    }
  }

  try {
    const storedSize = localStorage.getItem(PAGE_SETUP_SIZE_KEY);
    if (storedSize && PAGE_SIZES[storedSize]) sizeSelect.value = storedSize;
    else sizeSelect.value = DEFAULT_PAGE_SIZE_ID;
    const storedMargins = JSON.parse(
      localStorage.getItem(PAGE_SETUP_MARGINS_KEY) || "null",
    );
    const inputs = {
      top: document.getElementById("marginTopInput"),
      right: document.getElementById("marginRightInput"),
      bottom: document.getElementById("marginBottomInput"),
      left: document.getElementById("marginLeftInput"),
    };
    for (const [side, el] of Object.entries(inputs)) {
      if (!el) continue;
      const v =
        storedMargins && Number.isFinite(Number(storedMargins[side]))
          ? clampMargin(storedMargins[side], DEFAULT_MARGINS_IN[side])
          : DEFAULT_MARGINS_IN[side];
      el.value = v;
    }
  } catch (e) {
    sizeSelect.value = DEFAULT_PAGE_SIZE_ID;
  }

  function persist() {
    try {
      localStorage.setItem(PAGE_SETUP_SIZE_KEY, sizeSelect.value);
      localStorage.setItem(
        PAGE_SETUP_MARGINS_KEY,
        JSON.stringify(getPageSetup().margins),
      );
    } catch (e) {
      // localStorage unavailable, panel still works for this session
    }
  }

  sizeSelect.addEventListener("change", persist);
  panel
    .querySelectorAll('input[type="number"]')
    .forEach((el) => el.addEventListener("change", persist));

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      panel.classList.toggle("visible");
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      panel.classList.remove("visible");
    });
  }
}

const PageSetup = {
  PAGE_SIZES,
  DEFAULT_PAGE_SIZE_ID,
  DEFAULT_MARGINS_IN,
  getPageSetup,
  initPageSetupPanel,
};

if (typeof window !== "undefined") {
  window.PageSetup = PageSetup;
}
if (typeof globalThis !== "undefined") {
  globalThis.PageSetup = globalThis.PageSetup || PageSetup;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPageSetupPanel);
  } else {
    initPageSetupPanel();
  }
}
