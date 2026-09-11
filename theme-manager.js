const ThemeManager = (function () {
  const STORAGE_KEY = "marky-theme";
  const THEME_ATTR = "data-theme";
  const LIGHT = "light";
  const DARK = "dark";

  // All available themes: built-ins + 20 Fable 5.1 themes (001-020).
  // Source palettes: https://miaai-lab.github.io/Fable-5.1-100-HTML-Files/
  const THEMES = [
    { id: "light", name: "Light (Default)" },
    { id: "dark", name: "Dark" },
    { id: "aurora-glass", name: "001 · Aurora Glass" },
    { id: "brutalist-manifesto", name: "002 · Brutalist Manifesto" },
    { id: "softdesk-neumorphic", name: "003 · Softdesk Neumorphic" },
    { id: "kestrel-terminal", name: "004 · Kestrel Terminal" },
    { id: "mercury-chrome", name: "005 · Mercury Chrome" },
    { id: "constellation", name: "006 · Constellation" },
    { id: "fog-editorial", name: "007 · Fog Editorial" },
    { id: "halden-luxury", name: "008 · Halden Luxury" },
    { id: "breathe-dawn", name: "009 · Breathe Dawn" },
    { id: "paper-valley-dusk", name: "010 · Paper Valley Dusk" },
    { id: "neon-drift", name: "011 · Neon Drift" },
    { id: "orbit-solar", name: "012 · Orbit Solar" },
    { id: "sumi-ink", name: "013 · Sumi Ink" },
    { id: "nocturne-sea", name: "014 · Nocturne Sea" },
    { id: "meridian-city", name: "015 · Meridian City" },
    { id: "ether-smoke", name: "016 · Ether Smoke" },
    { id: "pulse-heartbeat", name: "017 · Pulse Heartbeat" },
    { id: "bauhaus-komposition", name: "018 · Bauhaus Komposition" },
    { id: "karesansui-garden", name: "019 · Karesansui Garden" },
    { id: "signal-loss", name: "020 · Signal Loss" },
  ];

  const DARK_THEMES = new Set([
    "dark",
    "aurora-glass",
    "kestrel-terminal",
    "mercury-chrome",
    "constellation",
    "halden-luxury",
    "breathe-dawn",
    "paper-valley-dusk",
    "neon-drift",
    "orbit-solar",
    "nocturne-sea",
    "ether-smoke",
    "pulse-heartbeat",
    "signal-loss",
  ]);

  const VALID_THEMES = new Set(THEMES.map((t) => t.id));

  let systemMediaQuery = null;

  function getSystemPreference() {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return DARK;
    }
    return LIGHT;
  }

  function hasExplicitPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch (e) {
      return false;
    }
  }

  function isValidTheme(theme) {
    return VALID_THEMES.has(theme);
  }

  function isDarkTheme(theme) {
    return DARK_THEMES.has(theme);
  }

  function getCurrentTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidTheme(stored)) {
        return stored;
      }
    } catch (e) {
      // localStorage unavailable
    }
    return getSystemPreference();
  }

  function applyTheme(theme) {
    if (!isValidTheme(theme)) {
      theme = LIGHT;
    }
    document.documentElement.setAttribute(THEME_ATTR, theme);
  }

  function setTheme(theme) {
    if (!isValidTheme(theme)) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // localStorage unavailable, continue anyway
    }
    applyTheme(theme);
    updateToggleButton(theme);
    syncThemeSelect(theme);
    // Re-render mermaid diagrams with new theme
    if (typeof reRenderMermaidWithTheme === "function") {
      reRenderMermaidWithTheme(theme);
    }
  }

  function clearPreference() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // localStorage unavailable
    }
    const systemTheme = getSystemPreference();
    applyTheme(systemTheme);
    updateToggleButton(systemTheme);
    syncThemeSelect(systemTheme);
  }

  function toggle() {
    const current = getCurrentTheme();
    // Quick toggle only switches between light/dark.
    // For Fable themes, use the dropdown selector.
    const newTheme =
      current === LIGHT ? DARK : current === DARK ? LIGHT : LIGHT;
    setTheme(newTheme);
  }

  function updateToggleButton(theme) {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;

    // Reflect dark-ish state on the switch for all dark Fable themes.
    const visual = isDarkTheme(theme) ? DARK : LIGHT;
    toggle.setAttribute("data-theme", visual);
    toggle.setAttribute("aria-checked", visual === DARK ? "true" : "false");

    if (visual === DARK) {
      toggle.setAttribute("aria-label", "Switch to light mode");
    } else {
      toggle.setAttribute("aria-label", "Switch to dark mode");
    }
  }

  function syncThemeSelect(theme) {
    const select = document.getElementById("themeSelect");
    if (!select) return;
    if (isValidTheme(theme)) {
      select.value = theme;
    }
  }

  function populateThemeSelect() {
    const select = document.getElementById("themeSelect");
    if (!select) return;
    // Clear existing options (in case init runs twice)
    select.innerHTML = "";
    for (const t of THEMES) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      select.appendChild(opt);
    }
    select.value = getCurrentTheme();
    select.addEventListener("change", (e) => {
      setTheme(e.target.value);
    });
  }

  function watchSystemChanges() {
    if (!window.matchMedia) return;

    systemMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e) => {
      if (!hasExplicitPreference()) {
        const newTheme = e.matches ? DARK : LIGHT;
        applyTheme(newTheme);
        updateToggleButton(newTheme);
        syncThemeSelect(newTheme);
      }
    };

    if (systemMediaQuery.addEventListener) {
      systemMediaQuery.addEventListener("change", handler);
    } else if (systemMediaQuery.addListener) {
      systemMediaQuery.addListener(handler);
    }
  }

  function init() {
    const theme = getCurrentTheme();
    applyTheme(theme);
    updateToggleButton(theme);
    populateThemeSelect();
    syncThemeSelect(theme);
    watchSystemChanges();

    const toggleButton = document.getElementById("themeToggle");
    if (toggleButton) {
      toggleButton.addEventListener("click", toggle);
      toggleButton.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    }
  }

  return {
    init,
    toggle,
    getCurrentTheme,
    applyTheme,
    setTheme,
    hasExplicitPreference,
    clearPreference,
    getSystemPreference,
    watchSystemChanges,
    updateToggleButton,
    isValidTheme,
    isDarkTheme,
    getThemes() {
      return THEMES.slice();
    },
  };
})();

if (typeof window !== "undefined") {
  window.ThemeManager = ThemeManager;
  // Back-compat: some inline scripts expect MARKY_THEMES
  window.MARKY_THEMES = ThemeManager.getThemes();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ThemeManager.init);
  } else {
    ThemeManager.init();
  }
}
