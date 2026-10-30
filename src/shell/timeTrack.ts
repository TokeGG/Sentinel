// Per-panel time tracking (pure, local only, opt-in via app_settings `time_track`).
export const TIME_TRACK_KEY = "time_track";
export const TICK_SECS = 60;
/** Counts a tick only while the panel is visible and focused. */
export const shouldCount = (enabled: boolean, visible: boolean, focused: boolean) => enabled && visible && focused;
export const fmtDur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor(s / 60) % 60} min` : `${Math.floor(s / 60)} min`);
export function totals(rows: { day: string; panel_id: string; secs: number }[], since: string): { panel: string; secs: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) if (r.day >= since) m.set(r.panel_id, (m.get(r.panel_id) ?? 0) + r.secs);
  return [...m].map(([panel, secs]) => ({ panel, secs })).sort((a, b) => b.secs - a.secs);
}
