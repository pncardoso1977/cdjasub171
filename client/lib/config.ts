export interface SiteColors {
  background?: string; // HSL tokens "h s% l%" or hex
  foreground?: string;
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  accent?: string;
  accentForeground?: string;
  border?: string;
  input?: string;
  ring?: string;
}

export interface SiteConfig {
  title: string;
  logoUrl: string;
  colors?: SiteColors;
}

const DEFAULT_CONFIG: SiteConfig = {
  title: "25/26 SUB-19",
  logoUrl: "https://i.ytimg.com/vi/iW63bf13MMs/hqdefault.jpg",
  colors: {
    background: "0 0% 0%",
    foreground: "0 0% 100%",
    primary: "49 97% 51%",
    primaryForeground: "0 0% 0%",
    secondary: "0 0% 12%",
    secondaryForeground: "0 0% 100%",
    border: "0 0% 20%",
    input: "0 0% 20%",
    ring: "49 97% 51%",
  },
};

export async function loadSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch("/config.json", { cache: "no-store" });
    if (!res.ok) return DEFAULT_CONFIG;
    const cfg = (await res.json()) as Partial<SiteConfig>;
    return { ...DEFAULT_CONFIG, ...cfg, colors: { ...DEFAULT_CONFIG.colors, ...(cfg.colors || {}) } };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function isHslTokens(v: string) {
  return /\d+\s+\d+%\s+\d+%/.test(v);
}

function hexToHslTokens(hex: string): string | null {
  const norm = hex.replace(/^#/, "");
  if (![3, 6].includes(norm.length)) return null;
  const parse = (s: string) => parseInt(s.length === 1 ? s + s : s, 16);
  const r = parse(norm.length === 3 ? norm[0]! : norm.slice(0, 2));
  const g = parse(norm.length === 3 ? norm[1]! : norm.slice(2, 4));
  const b = parse(norm.length === 3 ? norm[2]! : norm.slice(4, 6));
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rf: h = (gf - bf) / d + (gf < bf ? 6 : 0); break;
      case gf: h = (bf - rf) / d + 2; break;
      case bf: h = (rf - gf) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyThemeColors(colors?: SiteColors) {
  if (!colors) return;
  const root = document.documentElement;
  const set = (name: string, val?: string) => {
    if (!val) return;
    const v = isHslTokens(val) ? val : hexToHslTokens(val) || val;
    root.style.setProperty(`--${name}`, v);
  };
  set("background", colors.background);
  set("foreground", colors.foreground);
  set("primary", colors.primary);
  set("primary-foreground", colors.primaryForeground);
  set("secondary", colors.secondary);
  set("secondary-foreground", colors.secondaryForeground);
  set("accent", colors.accent);
  set("accent-foreground", colors.accentForeground);
  set("border", colors.border);
  set("input", colors.input);
  set("ring", colors.ring);
}
