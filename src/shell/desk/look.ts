// Pure look settings: title bar style, the user's custom theme (theme builder,
// app_settings `custom_theme` JSON) and opt-in seasonal themes (`seasonal_theme`).
export const TITLE_STYLES = ["normal", "compact", "autohide"] as const;
export type TitleStyle = (typeof TITLE_STYLES)[number];
export const toTitleStyle = (v: unknown): TitleStyle => ((TITLE_STYLES as readonly unknown[]).includes(v) ? (v as TitleStyle) : "normal");

export type CustomTheme = { base: string; raised: string; overlay: string; text: string; font: string };
export const DEFAULT_CUSTOM: CustomTheme = { base: "#0a0d16", raised: "#111522", overlay: "#181d2e", text: "#e6eaf4", font: "" };
export const FONTS = ["", "Segoe UI", "Inter", "Georgia", "Consolas", "Comic Sans MS"];
const HEX = /^#[0-9a-f]{6}$/i;

export function cleanCustom(raw: unknown): CustomTheme {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hex = (k: keyof CustomTheme) => (typeof r[k] === "string" && HEX.test(r[k] as string) ? (r[k] as string).toLowerCase() : DEFAULT_CUSTOM[k]);
  return { base: hex("base"), raised: hex("raised"), overlay: hex("overlay"), text: hex("text"), font: FONTS.includes(r.font as string) ? (r.font as string) : "" };
}
/** Token overrides for the custom theme (same shape as THEMES entries). */
export function customVars(t: CustomTheme): Record<string, string> {
  const v: Record<string, string> = { "--base": t.base, "--raised": t.raised, "--overlay": t.overlay, "--text": t.text };
  if (t.font) { v["--font-body"] = `"${t.font}", system-ui, sans-serif`; v["--font-display"] = v["--font-body"]; }
  return v;
}

export type Season = "winter" | "spring" | "summer" | "autumn" | "halloween" | "holidays";
/** Season for a local date (northern hemisphere); Oct 20-31 and Dec 15-31 are special. */
export function seasonOf(d: Date): Season {
  const m = d.getMonth(), day = d.getDate();
  if (m === 9 && day >= 20) return "halloween";
  if (m === 11 && day >= 15) return "holidays";
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}
export const SEASON_VARS: Record<Season, Record<string, string>> = {
  winter: { "--base": "#0b1220", "--raised": "#122036" },
  spring: { "--base": "#0e1612", "--raised": "#15231b" },
  summer: { "--base": "#14120a", "--raised": "#221d10" },
  autumn: { "--base": "#160f0a", "--raised": "#241811" },
  halloween: { "--base": "#120a12", "--raised": "#1f0f14", "--accent": "#ff7a1a" },
  holidays: { "--base": "#0a1410", "--raised": "#14201a", "--accent": "#d43a3a" },
};
