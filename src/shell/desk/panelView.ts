// Pure per-panel view prefs (app_settings `panel_view_prefs`, JSON {id: prefs}):
// zoom, opacity, lock (no move/resize), remember scroll. "Always on top" reuses
// panel_pins (re-raise after other panels focus).
export type PanelView = { zoom: number; opacity: number; lock: boolean; keepScroll: boolean };
export const DEFAULT_VIEW: PanelView = { zoom: 1, opacity: 1, lock: false, keepScroll: true };
export type PanelViews = Record<string, PanelView>;

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function cleanView(raw: unknown): PanelView {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    zoom: Math.round(clamp(r.zoom, 0.5, 2, 1) * 100) / 100,
    opacity: Math.round(clamp(r.opacity, 0.3, 1, 1) * 100) / 100,
    lock: r.lock === true,
    keepScroll: r.keepScroll !== false,
  };
}
export function sanitizeViews(raw: unknown): PanelViews {
  const out: PanelViews = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (/^[\w.\-]{1,64}$/.test(k)) out[k] = cleanView(v);
  return out;
}
export const viewOf = (all: PanelViews, id: string): PanelView => all[id] ?? DEFAULT_VIEW;
/** Ctrl+= / Ctrl+- / Ctrl+0 steps of 10%. */
export function stepZoom(z: number, dir: 1 | -1 | 0): number {
  if (dir === 0) return 1;
  return Math.round(Math.min(2, Math.max(0.5, z + dir * 0.1)) * 100) / 100;
}
/** CSS for the panel body; 1/1 = no style. */
export function viewStyle(v: PanelView): { zoom?: string; opacity?: string } {
  return { ...(v.zoom !== 1 ? { zoom: String(v.zoom) } : {}), ...(v.opacity !== 1 ? { opacity: String(v.opacity) } : {}) };
}
