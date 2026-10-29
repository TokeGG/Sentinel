// Pure panel snapping + tile presets. Rects are in main-window client px.
import { clampToScreen, tile, type Rect } from "../layout.ts";

export const SNAP_PX = 16;

/** Snap each edge of `r` to the screen edges or to other panels' edges within `px`; size is kept. */
export function snapRect(r: Rect, screen: Rect, others: Rect[], px = SNAP_PX): Rect {
  const xs = [screen.x, screen.x + screen.w, ...others.flatMap((o) => [o.x, o.x + o.w])];
  const ys = [screen.y, screen.y + screen.h, ...others.flatMap((o) => [o.y, o.y + o.h])];
  const best = (a: number, size: number, lines: number[]) => {
    let d = px + 1, out = a;
    for (const l of lines) {
      if (Math.abs(l - a) < d) { d = Math.abs(l - a); out = l; }
      if (Math.abs(l - (a + size)) < d) { d = Math.abs(l - (a + size)); out = l - size; }
    }
    return out;
  };
  return clampToScreen({ ...r, x: best(r.x, r.w, xs), y: best(r.y, r.h, ys) }, screen, { w: 0, h: 0 });
}

export type TilePreset = "grid" | "columns" | "rows" | "main";
export const TILE_PRESETS: TilePreset[] = ["grid", "columns", "rows", "main"];

/** `n` rects covering `screen` for a preset. "main" = first panel 60% left, rest stacked right. */
export function tileRects(preset: TilePreset, n: number, s: Rect): Rect[] {
  if (n <= 0) return [];
  const split = (count: number, horiz: boolean): Rect[] =>
    Array.from({ length: count }, (_, i) => {
      const a = Math.round((i * (horiz ? s.w : s.h)) / count), b = Math.round(((i + 1) * (horiz ? s.w : s.h)) / count);
      return horiz ? { x: s.x + a, y: s.y, w: b - a, h: s.h } : { x: s.x, y: s.y + a, w: s.w, h: b - a };
    });
  if (preset === "columns") return split(n, true);
  if (preset === "rows") return split(n, false);
  if (preset === "main") {
    if (n === 1) return [{ ...s }];
    const mw = Math.round(s.w * 0.6);
    const right = { x: s.x + mw, y: s.y, w: s.w - mw, h: s.h };
    const stack = Array.from({ length: n - 1 }, (_, i) => {
      const a = Math.round((i * right.h) / (n - 1)), b = Math.round(((i + 1) * right.h) / (n - 1));
      return { x: right.x, y: right.y + a, w: right.w, h: b - a };
    });
    return [{ x: s.x, y: s.y, w: mw, h: s.h }, ...stack];
  }
  return tile(n, s);
}

export type Mon = { name: string | null; position: { x: number; y: number }; size: { width: number; height: number } };
/** Index of the monitor after the one containing point `p` (wraps); -1 when none. */
export function nextMonitor(mons: Mon[], p: { x: number; y: number }): number {
  if (mons.length === 0) return -1;
  const i = mons.findIndex((m) => p.x >= m.position.x && p.x < m.position.x + m.size.width && p.y >= m.position.y && p.y < m.position.y + m.size.height);
  return (i + 1) % mons.length;
}
