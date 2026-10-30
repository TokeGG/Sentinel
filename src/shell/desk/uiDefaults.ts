// Pure shell-wide defaults (app_settings `ui_defaults`, JSON): item counts for the briefing, the Terminal
// home boxes, the Ctrl+K palette and the terminal log, plus clock format and temperature unit.
// Anything missing/bad = the old hard-coded value.
export type ClockFmt = "24h" | "12h";
export type TempUnit = "°C" | "°F";
export interface UiCounts { briefingRows: number; terminalRows: number; terminalLater: number; paletteResults: number; terminalLog: number }
export interface UiDefaults extends UiCounts { clock: ClockFmt; temp: TempUnit }
export const UI_DEFAULTS_KEY = "ui_defaults";
export const DEFAULT_UI: UiDefaults = { briefingRows: 5, terminalRows: 6, terminalLater: 8, paletteResults: 40, terminalLog: 14, clock: "24h", temp: "°C" };
export const UI_LIMITS: Record<keyof UiCounts, [number, number]> = {
  briefingRows: [1, 20], terminalRows: [1, 20], terminalLater: [1, 30], paletteResults: [5, 200], terminalLog: [5, 100],
};

export function sanitizeUi(v: unknown): UiDefaults {
  const o = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_UI };
  for (const k of Object.keys(UI_LIMITS) as (keyof UiCounts)[]) {
    const n = Number(o[k]);
    const [lo, hi] = UI_LIMITS[k];
    if (o[k] !== undefined && o[k] !== null && o[k] !== "" && Number.isFinite(n)) out[k] = Math.min(hi, Math.max(lo, Math.round(n)));
  }
  if (o.clock === "12h") out.clock = "12h";
  if (o.temp === "°F") out.temp = "°F";
  return out;
}
export const parseUi = (s: string | null | undefined): UiDefaults => { try { return sanitizeUi(JSON.parse(s ?? "{}")); } catch { return { ...DEFAULT_UI }; } };

const p2 = (n: number) => String(n).padStart(2, "0");
/** "14:05" or "2:05 PM". */
export function hhmm(h: number, m: number, clock: ClockFmt): string {
  return clock === "12h" ? `${h % 12 || 12}:${p2(m)} ${h < 12 ? "AM" : "PM"}` : `${p2(h)}:${p2(m)}`;
}
/** Wall time in an IANA zone in the chosen format. */
export function zoneTime(d: Date, zone: string, clock: ClockFmt, weekday = false): string {
  return new Intl.DateTimeFormat(clock === "12h" ? "en-US" : "en-GB", { timeZone: zone, hour: clock === "12h" ? "numeric" : "2-digit", minute: "2-digit", hourCycle: clock === "12h" ? "h12" : "h23", ...(weekday ? { weekday: "short" as const } : {}) }).format(d);
}
/** Celsius value shown in the chosen unit, e.g. "21°C" / "70°F"; "—" when missing. */
export function tempIn(c: number | null | undefined, unit: TempUnit): string {
  if (c === null || c === undefined || !Number.isFinite(c)) return "—";
  return `${Math.round(unit === "°F" ? c * 9 / 5 + 32 : c)}${unit}`;
}
