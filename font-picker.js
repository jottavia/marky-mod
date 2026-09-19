// Word-style document font picker: family + size for the editor and exports.
//
// Applies a document-wide default font to #editor (inherited by all content,
// like Word's Normal style). Choices persist to localStorage; PDF, DOCX, and
// HTML exports read the live toolbar controls via getFont(), so exports honor
// what the picker shows.
//
// Font stacks are system fonts only — no webfont downloads — so the app stays
// fully offline-capable and no data leaks to font servers (privacy stance).
// Each entry carries a single-family `docx` name because the .docx format
// wants one family per run, not a CSS fallback stack.

const FONT_STACKS = {
  default: {
    name: "Default (System)",
    group: null,
    // Empty stack = inherit the app stylesheet (zero visual change).
    stack: "",
    // Preserve today's DOCX output exactly until the user picks a font.
    docx: "Arial",
  },
  // --- Sans-Serif (Word classics first) ---
  calibri: {
    name: "Calibri",
    group: "Sans-Serif",
    stack: '"Calibri", "Carlito", "Segoe UI", sans-serif',
    docx: "Calibri",
  },
  arial: {
    name: "Arial",
    group: "Sans-Serif",
    stack: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    docx: "Arial",
  },
  helvetica: {
    name: "Helvetica",
    group: "Sans-Serif",
    stack: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    docx: "Arial",
  },
  segoe: {
    name: "Segoe UI",
    group: "Sans-Serif",
    stack: '"Segoe UI", "Segoe UI Variable", system-ui, sans-serif',
    docx: "Segoe UI",
  },
  trebuchet: {
    name: "Trebuchet MS",
    group: "Sans-Serif",
    stack: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
    docx: "Trebuchet MS",
  },
  verdana: {
    name: "Verdana",
    group: "Sans-Serif",
    stack: 'Verdana, Geneva, "Segoe UI", sans-serif',
    docx: "Verdana",
  },
  tahoma: {
    name: "Tahoma",
    group: "Sans-Serif",
    stack: "Tahoma, Geneva, Verdana, sans-serif",
    docx: "Tahoma",
  },
  century: {
    name: "Century Gothic",
    group: "Sans-Serif",
    stack: '"Century Gothic", CenturyGothic, AppleGothic, sans-serif',
    docx: "Century Gothic",
  },
  franklin: {
    name: "Franklin Gothic",
    group: "Sans-Serif",
    stack:
      '"Franklin Gothic Medium", "Franklin Gothic", "ITC Franklin Gothic", Arial, sans-serif',
    docx: "Franklin Gothic Medium",
  },
  system: {
    name: "System UI",
    group: "Sans-Serif",
    stack:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    docx: "Arial",
  },
  // --- Serif ---
  cambria: {
    name: "Cambria",
    group: "Serif",
    stack: 'Cambria, "Cambria Math", Georgia, serif',
    docx: "Cambria",
  },
  garamond: {
    name: "Garamond",
    group: "Serif",
    stack: 'Garamond, "EB Garamond", "Adobe Garamond Pro", Georgia, serif',
    docx: "Garamond",
  },
  georgia: {
    name: "Georgia",
    group: "Serif",
    stack: 'Georgia, "Times New Roman", serif',
    docx: "Georgia",
  },
  times: {
    name: "Times New Roman",
    group: "Serif",
    stack: '"Times New Roman", Times, Georgia, serif',
    docx: "Times New Roman",
  },
  palatino: {
    name: "Palatino",
    group: "Serif",
    stack: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
    docx: "Palatino Linotype",
  },
  book: {
    name: "Book Antiqua",
    group: "Serif",
    stack: '"Book Antiqua", Palatino, Georgia, serif',
    docx: "Book Antiqua",
  },
  // --- Monospace ---
  consolas: {
    name: "Consolas",
    group: "Monospace",
    stack: 'Consolas, "Lucida Console", Menlo, monospace',
    docx: "Consolas",
  },
  courier: {
    name: "Courier New",
    group: "Monospace",
    stack: '"Courier New", Courier, monospace',
    docx: "Courier New",
  },
  lucida: {
    name: "Lucida Console",
    group: "Monospace",
    stack: '"Lucida Console", Monaco, monospace',
    docx: "Lucida Console",
  },
  menlo: {
    name: "Menlo",
    group: "Monospace",
    stack: 'Menlo, Monaco, Consolas, "Courier New", monospace',
    docx: "Menlo",
  },
  cascadia: {
    name: "Cascadia Code",
    group: "Monospace",
    stack: '"Cascadia Code", Consolas, Menlo, monospace',
    docx: "Cascadia Code",
  },
  // --- Display ---
  impact: {
    name: "Impact",
    group: "Display",
    stack: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
    docx: "Impact",
  },
  comic: {
    name: "Comic Sans MS",
    group: "Display",
    stack: '"Comic Sans MS", "Comic Sans", Chalkboard, cursive',
    docx: "Comic Sans MS",
  },
};

// Word's font-size dropdown values, in points.
const FONT_SIZES_PT = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
];

const DEFAULT_FONT_FAMILY_ID = "default";
// 12pt == 16px: matches the unstyled editor, so defaults change nothing.
const DEFAULT_FONT_SIZE_PT = 12;
const FONT_FAMILY_KEY = "marky-font-family";
const FONT_SIZE_KEY = "marky-font-size";

function clampFontSize(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(72, Math.max(8, Math.round(n)));
}

// Stored values (or defaults) without consulting the DOM.
function readStoredFont() {
  let familyId = DEFAULT_FONT_FAMILY_ID;
  let sizePt = DEFAULT_FONT_SIZE_PT;
  try {
    const storedFamily = localStorage.getItem(FONT_FAMILY_KEY);
    if (storedFamily && FONT_STACKS[storedFamily]) familyId = storedFamily;
    // getItem returns null when unset; Number(null) is 0, so guard first.
    const storedSizeRaw = localStorage.getItem(FONT_SIZE_KEY);
    if (storedSizeRaw !== null && storedSizeRaw !== "") {
      const storedSize = Number(storedSizeRaw);
      if (Number.isFinite(storedSize)) {
        sizePt = clampFontSize(storedSize, DEFAULT_FONT_SIZE_PT);
      }
    }
  } catch (e) {
    // localStorage unavailable; defaults stand
  }
  return { familyId, sizePt };
}

// Read the live toolbar controls (falling back to persisted values,
// then to defaults).
function getFont() {
  const stored = readStoredFont();
  let familyId = stored.familyId;
  let sizePt = stored.sizePt;

  if (typeof document !== "undefined") {
    const familySelect = document.getElementById("fontFamilySelect");
    if (familySelect && FONT_STACKS[familySelect.value]) {
      familyId = familySelect.value;
    }
    const sizeSelect = document.getElementById("fontSizeSelect");
    if (sizeSelect && sizeSelect.value !== "") {
      sizePt = clampFontSize(sizeSelect.value, sizePt);
    }
  }

  const entry = FONT_STACKS[familyId] || FONT_STACKS[DEFAULT_FONT_FAMILY_ID];
  return {
    familyId,
    name: entry.name,
    stack: entry.stack,
    docxFont: entry.docx,
    sizePt,
  };
}

function applyFontToEditor() {
  if (typeof document === "undefined") return;
  const editorEl = document.getElementById("editor");
  if (!editorEl) return;
  const font = getFont();
  // Empty stack clears the inline style so the stylesheet shows through.
  editorEl.style.fontFamily = font.stack || "";
  editorEl.style.fontSize = `${font.sizePt}pt`;
}

function initFontPicker() {
  const familySelect = document.getElementById("fontFamilySelect");
  const sizeSelect = document.getElementById("fontSizeSelect");
  const growBtn = document.getElementById("fontGrowBtn");
  const shrinkBtn = document.getElementById("fontShrinkBtn");
  if (!familySelect || !sizeSelect) return;

  function makeFamilyOption(id, entry) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = entry.name;
    // Word-like touch: each entry renders in its own typeface.
    if (entry.stack) opt.style.fontFamily = entry.stack;
    return opt;
  }

  if (familySelect.options.length === 0) {
    familySelect.appendChild(
      makeFamilyOption(
        DEFAULT_FONT_FAMILY_ID,
        FONT_STACKS[DEFAULT_FONT_FAMILY_ID],
      ),
    );
    for (const group of ["Sans-Serif", "Serif", "Monospace", "Display"]) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group;
      for (const [id, entry] of Object.entries(FONT_STACKS)) {
        if (entry.group === group) optgroup.appendChild(makeFamilyOption(id, entry));
      }
      familySelect.appendChild(optgroup);
    }
  }

  if (sizeSelect.options.length === 0) {
    for (const pt of FONT_SIZES_PT) {
      const opt = document.createElement("option");
      opt.value = String(pt);
      opt.textContent = String(pt);
      sizeSelect.appendChild(opt);
    }
  }

  // Seed the controls from stored values (or defaults) BEFORE anything
  // reads the live DOM: a freshly-populated select auto-selects its first
  // option, which would otherwise masquerade as the user's choice.
  const font = readStoredFont();
  familySelect.value = font.familyId;
  // The select only offers Word sizes; snap anything else to nearest.
  let nearest = FONT_SIZES_PT[0];
  for (const pt of FONT_SIZES_PT) {
    if (Math.abs(pt - font.sizePt) < Math.abs(nearest - font.sizePt)) {
      nearest = pt;
    }
  }
  sizeSelect.value = String(nearest);

  function persist() {
    try {
      localStorage.setItem(FONT_FAMILY_KEY, familySelect.value);
      localStorage.setItem(FONT_SIZE_KEY, sizeSelect.value);
    } catch (e) {
      // localStorage unavailable, picker still works for this session
    }
  }

  // Only stamp inline styles when the user has a saved choice; otherwise
  // leave the DOM alone so an exported file's first paint keeps the
  // author's font (same deal as the theme's data-theme handoff).
  let hasStored = false;
  try {
    hasStored =
      localStorage.getItem(FONT_FAMILY_KEY) !== null ||
      localStorage.getItem(FONT_SIZE_KEY) !== null;
  } catch (e) {
    hasStored = false;
  }
  if (hasStored) applyFontToEditor();

  familySelect.addEventListener("change", () => {
    persist();
    applyFontToEditor();
  });
  sizeSelect.addEventListener("change", () => {
    persist();
    applyFontToEditor();
  });

  function stepSize(direction) {
    const current = clampFontSize(sizeSelect.value, DEFAULT_FONT_SIZE_PT);
    let idx = FONT_SIZES_PT.indexOf(current);
    if (idx === -1) {
      // Snap to the nearest step in the requested direction.
      idx =
        direction > 0
          ? FONT_SIZES_PT.findIndex((pt) => pt > current)
          : FONT_SIZES_PT.length -
            1 -
            [...FONT_SIZES_PT].reverse().findIndex((pt) => pt < current);
      if (idx < 0 || idx >= FONT_SIZES_PT.length) return;
    } else {
      idx = Math.min(
        FONT_SIZES_PT.length - 1,
        Math.max(0, idx + direction),
      );
    }
    sizeSelect.value = String(FONT_SIZES_PT[idx]);
    persist();
    applyFontToEditor();
  }

  if (growBtn) growBtn.addEventListener("click", () => stepSize(1));
  if (shrinkBtn) shrinkBtn.addEventListener("click", () => stepSize(-1));
}

const FontPicker = {
  FONT_STACKS,
  FONT_SIZES_PT,
  DEFAULT_FONT_FAMILY_ID,
  DEFAULT_FONT_SIZE_PT,
  getFont,
  applyFontToEditor,
  initFontPicker,
};

if (typeof window !== "undefined") {
  window.FontPicker = FontPicker;
}
if (typeof globalThis !== "undefined") {
  globalThis.FontPicker = globalThis.FontPicker || FontPicker;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFontPicker);
  } else {
    initFontPicker();
  }
}
