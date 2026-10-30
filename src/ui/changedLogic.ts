// Pure "what changed since you last looked": compares a module's badge count now with the one
// saved when its panel last opened (app_settings `last_seen:<id>` = {at, count}).
export type Seen = { at: number; count: number };
export const parseSeen = (s: string | null): Seen | null => {
  try { const v = JSON.parse(s ?? "null"); return v && Number.isFinite(v.at) && Number.isFinite(v.count) ? { at: v.at, count: v.count } : null; } catch { return null; }
};
export function ago(ms: number): string {
  const m = Math.round(ms / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}
/** Banner text, or null when nothing grew (first visit included). */
export function changedText(prev: Seen | null, count: number, now: number): string | null {
  if (!prev || count <= prev.count) return null;
  return `${count - prev.count} new since you last looked (${ago(now - prev.at)})`;
}
