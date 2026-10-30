// Pure shell-wide defaults (app_settings `ui_defaults`, JSON): how many items show in the briefing,
// the Terminal home boxes, the Ctrl+K palette and the terminal log. Anything missing/bad = default.
export interface UiDefaults { briefingRows: number; terminalRows: number; paletteResults: number; terminalLog: number }
export const UI_DEFAULTS_KEY = "ui_defaults";
export const DEFAULT_UI: UiDefaults = { briefingRows: 5, terminalRows: 6, paletteResults: 40, terminalLog: 14 };
export const UI_LIMITS: Record<keyof UiDefaults, [number, number]> = {
  briefingRows: [1, 20], terminalRows: [1, 20], paletteResults: [5, 200], terminalLog: [5, 100],
};

export function sanitizeUi(v: unknown): UiDefaults {
  const o = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_UI };
  for (const k of Object.keys(DEFAULT_UI) as (keyof UiDefaults)[]) {
    const n = Number(o[k]);
    const [lo, hi] = UI_LIMITS[k];
    if (o[k] !== undefined && o[k] !== null && o[k] !== "" && Number.isFinite(n)) out[k] = Math.min(hi, Math.max(lo, Math.round(n)));
  }
  return out;
}
export const parseUi = (s: string | null | undefined): UiDefaults => { try { return sanitizeUi(JSON.parse(s ?? "{}")); } catch { return { ...DEFAULT_UI }; } };
