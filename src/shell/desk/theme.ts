// Pure themes + day/night sky. A theme is a small set of token overrides set on
// :root (tokens.css stays the single source of defaults). Opt-in.
export type ThemeId = "default" | "midnight" | "dawn" | "contrast";
export const THEMES: Record<ThemeId, Record<string, string>> = {
  default: {},
  midnight: { "--base": "#05070d", "--raised": "#0a0e18", "--overlay": "#101626" },
  dawn: { "--base": "#1a1420", "--raised": "#221a2a", "--overlay": "#2c2236" },
  contrast: { "--base": "#000000", "--text": "#ffffff", "--text-dim": "#e6e6e6", "--line-base": "rgba(255, 255, 255, 0.4)" },
};
export const isTheme = (t: unknown): t is ThemeId => typeof t === "string" && t in THEMES;

export type SkyPhase = "night" | "dawn" | "day" | "dusk";
/** Phase from local hour (0-23.99). */
export function skyPhase(hour: number): SkyPhase {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 18) return "day";
  if (h >= 18 && h < 21) return "dusk";
  return "night";
}
/** Overlay tint (CSS colour with alpha) drawn over the star map. */
export const SKY_TINT: Record<SkyPhase, string> = {
  night: "transparent",
  dawn: "rgba(255, 150, 110, 0.08)",
  day: "rgba(120, 170, 255, 0.10)",
  dusk: "rgba(190, 100, 160, 0.09)",
};
