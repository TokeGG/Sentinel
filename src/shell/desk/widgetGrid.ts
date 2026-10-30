// Pure home-widget grid (app_settings `home_widgets`, JSON): widgets on a 12-column grid with row units.
// Widget ids: a built-in box ("today", "feed", ...) or "mod:<module id>". No overlaps: placing or moving
// a widget pushes anything it lands on downward.
export const COLS = 12;
export const MAX_ROWS = 60;
export interface Widget { id: string; x: number; y: number; w: number; h: number }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
const overlap = (a: Widget, b: Widget) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const fit = (g: Widget): Widget => { const w = clamp(g.w, 2, COLS), h = clamp(g.h, 1, 12); return { id: g.id, w, h, x: clamp(g.x, 0, COLS - w), y: clamp(g.y, 0, MAX_ROWS) }; };

/** Push widgets down until none overlap; `first` keeps its place. */
function settle(list: Widget[], first?: string): Widget[] {
  const order = [...list].sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : a.y - b.y || a.x - b.x));
  const out: Widget[] = [];
  for (const g of order) {
    const c = { ...g };
    while (out.some((o) => overlap(o, c))) c.y++;
    out.push(c);
  }
  return out;
}

export function sanitizeWidgets(v: unknown): Widget[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const ok = v.filter((g): g is Widget => !!g && typeof g.id === "string" && g.id.length <= 80 && [g.x, g.y, g.w, g.h].every((n) => typeof n === "number" && Number.isFinite(n)))
    .filter((g) => !seen.has(g.id) && !!seen.add(g.id)).slice(0, 40).map(fit);
  return settle(ok);
}
export const parseWidgets = (s: string | null): Widget[] | null => { if (!s) return null; try { return sanitizeWidgets(JSON.parse(s)); } catch { return null; } };

/** First free spot (top-left first) for a w x h widget. */
export function freeSpot(list: Widget[], w: number, h: number): { x: number; y: number } {
  for (let y = 0; y < MAX_ROWS; y++) for (let x = 0; x + w <= COLS; x++) if (!list.some((o) => overlap(o, { id: "", x, y, w, h }))) return { x, y };
  return { x: 0, y: Math.max(0, ...list.map((o) => o.y + o.h)) };
}
export function addWidget(list: Widget[], id: string, at?: { x: number; y: number }, w = 4, h = 4): Widget[] {
  if (list.some((g) => g.id === id)) return list;
  const pos = at ?? freeSpot(list, w, h);
  return settle([...list, fit({ id, w, h, ...pos })], id);
}
export const removeWidget = (list: Widget[], id: string) => list.filter((g) => g.id !== id);
export function moveWidget(list: Widget[], id: string, x: number, y: number): Widget[] {
  return settle(list.map((g) => (g.id === id ? fit({ ...g, x, y }) : g)), id);
}
export function resizeWidget(list: Widget[], id: string, w: number, h: number): Widget[] {
  return settle(list.map((g) => (g.id === id ? fit({ ...g, w, h }) : g)), id);
}
/** Grid cell under a point, given the grid's pixel box and row height. */
export function cellAt(px: number, py: number, box: { left: number; top: number; width: number }, rowH: number): { x: number; y: number } {
  return { x: clamp(Math.floor(((px - box.left) / box.width) * COLS), 0, COLS - 1), y: clamp(Math.floor((py - box.top) / rowH), 0, MAX_ROWS) };
}
export function defaultWidgets(ids: string[]): Widget[] {
  return ids.reduce<Widget[]>((acc, id) => addWidget(acc, id, undefined, id === "counts" || id === "apps" ? 12 : 4, id === "apps" || id === "counts" ? 2 : 4), []);
}
