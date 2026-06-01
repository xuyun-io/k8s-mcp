export type Theme = "dark" | "light";

export interface ThemeTokens {
  // Backgrounds
  bgBase: string;
  bgElevated: string;
  bgOverlay: string;
  bgInset: string;
  bgHover: string;
  bgActive: string;
  bgSelected: string;

  // Glass
  glassBg: string;
  glassBorder: string;
  glassBorderHighlight: string;
  glassShadow: string;

  // Borders
  border: string;
  borderStrong: string;
  borderHover: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Accents
  accent: string;
  accentHover: string;
  accentMuted: string;
  accentBg: string;

  // Semantic
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  info: string;
  infoBg: string;

  // Metrics
  cpu: string;
  cpuBg: string;
  memory: string;
  memoryBg: string;
  storage: string;
  storageBg: string;
}

const dark: ThemeTokens = {
  bgBase: "#000000",
  bgElevated: "#0A0A0F",
  bgOverlay: "#12121A",
  bgInset: "#050508",
  bgHover: "rgba(255,255,255,0.04)",
  bgActive: "rgba(255,255,255,0.08)",
  bgSelected: "rgba(59,130,246,0.12)",

  glassBg: "rgba(28, 28, 40, 0.45)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  glassBorderHighlight: "rgba(255, 255, 255, 0.18)",
  glassShadow: "0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06)",

  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.10)",
  borderHover: "rgba(255,255,255,0.18)",

  text: "#F0F4F8",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  textInverse: "#0A0A0F",

  accent: "#60A5FA",
  accentHover: "#93C5FD",
  accentMuted: "rgba(96,165,250,0.15)",
  accentBg: "rgba(96,165,250,0.10)",

  success: "#4ADE80",
  successBg: "rgba(74,222,128,0.12)",
  warning: "#FBBF24",
  warningBg: "rgba(251,191,36,0.12)",
  error: "#FB7185",
  errorBg: "rgba(251,113,133,0.12)",
  info: "#38BDF8",
  infoBg: "rgba(56,189,248,0.12)",

  cpu: "#F59E0B",
  cpuBg: "rgba(245,158,11,0.15)",
  memory: "#A78BFA",
  memoryBg: "rgba(167,139,250,0.15)",
  storage: "#38BDF8",
  storageBg: "rgba(56,189,248,0.15)",
};

const light: ThemeTokens = {
  bgBase: "#F0F2F5",
  bgElevated: "#FFFFFF",
  bgOverlay: "#F8FAFC",
  bgInset: "#E2E8F0",
  bgHover: "rgba(0,0,0,0.03)",
  bgActive: "rgba(0,0,0,0.06)",
  bgSelected: "rgba(59,130,246,0.08)",

  glassBg: "rgba(255, 255, 255, 0.55)",
  glassBorder: "rgba(255, 255, 255, 0.50)",
  glassBorderHighlight: "rgba(255, 255, 255, 0.90)",
  glassShadow: "0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.80)",

  border: "rgba(0,0,0,0.06)",
  borderStrong: "rgba(0,0,0,0.10)",
  borderHover: "rgba(0,0,0,0.16)",

  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  textInverse: "#FFFFFF",

  accent: "#2563EB",
  accentHover: "#1D4ED8",
  accentMuted: "rgba(37,99,235,0.12)",
  accentBg: "rgba(37,99,235,0.08)",

  success: "#16A34A",
  successBg: "rgba(22,163,74,0.10)",
  warning: "#D97706",
  warningBg: "rgba(217,119,6,0.10)",
  error: "#DC2626",
  errorBg: "rgba(220,38,38,0.10)",
  info: "#0284C7",
  infoBg: "rgba(2,132,199,0.10)",

  cpu: "#D97706",
  cpuBg: "rgba(217,119,6,0.12)",
  memory: "#7C3AED",
  memoryBg: "rgba(124,58,237,0.12)",
  storage: "#0284C7",
  storageBg: "rgba(2,132,199,0.12)",
};

export const themes: Record<Theme, ThemeTokens> = { dark, light };

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("k8s-theme") as Theme | null;
  if (stored && (stored === "dark" || stored === "light")) return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function setTheme(theme: Theme): void {
  localStorage.setItem("k8s-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function cssVar(name: keyof ThemeTokens, _theme?: Theme): string {
  return `var(--${name})`;
}

export function generateThemeCSS(theme: Theme): string {
  const t = themes[theme];
  const vars = Object.entries(t)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join("\n");
  return `:root[data-theme="${theme}"] {\n${vars}\n}`;
}

export const glassStyle: React.CSSProperties = {
  background: "var(--glassBg)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid var(--glassBorder)",
  borderTop: "1px solid var(--glassBorderHighlight)",
  boxShadow: "var(--glassShadow)",
  borderRadius: 16,
};

export const globalBaseStyles = `
  :root {
    color-scheme: dark;
  }
  :root[data-theme="light"] {
    color-scheme: light;
  }

  ${generateThemeCSS("dark")}
  ${generateThemeCSS("light")}

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial,
      sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    background: var(--bgBase);
    color: var(--text);
    min-height: 100vh;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--borderStrong); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--borderHover); }
`;
