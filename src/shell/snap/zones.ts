// Pure Windows-11-style snapping: edge zones while dragging, Snap Layouts
// (fractional zone sets), Snap Assist fill, and shared-divider group resize.
// Rects are main-window client px (same space as panel rects).
import type { Rect } from "../layout.ts";

export type Zone = "left" | "right" | "top" | "tl" | "tr" | "bl" | "br";
export type Frac = [number, number, number, number]; // x, y, w, h as fractions of the screen
export type SnapLayout = { id: string; name: string; zones: Frac[] };
export const EDGE_PX = 8, CORNER_PX = 80;

/** Zone under a pointer (client px) near the screen edges, or null. Corners win over edges. */
export function edgeZone(p: { x: number; y: number }, s: Rect, edge = EDGE_PX, corner = CORNER_PX): Zone | null {
  const l = p.x <= s.x + edge, r = p.x >= s.x + s.w - edge, t = p.y <= s.y + edge, b = p.y >= s.y + s.h - edge;
  const nearT = p.y <= s.y + corner, nearB = p.y >= s.y + s.h - corner, nearL = p.x <= s.x + corner, nearR = p.x >= s.x + s.w - corner;
  if ((l && nearT) || (t && nearL)) return "tl";
  if ((r && nearT) || (t && nearR)) return "tr";
  if ((l && nearB) || (b && nearL)) return "bl";
  if ((r && nearB) || (b && nearR)) return "br";
  if (l) return "left";
  if (r) return "right";
  if (t) return "top";
  return null;
}

const ZONE_FRAC: Record<Zone, Frac> = {
  left: [0, 0, 0.5, 1], right: [0.5, 0, 0.5, 1], top: [0, 0, 1, 1],
  tl: [0, 0, 0.5, 0.5], tr: [0.5, 0, 0.5, 0.5], bl: [0, 0.5, 0.5, 0.5], br: [0.5, 0.5, 0.5, 0.5],
};

/** Fraction -> px with `gap` between neighbours and around the outside. */
export function fracRect([fx, fy, fw, fh]: Frac, s: Rect, gap = 0): Rect {
  const x0 = Math.round(s.x + fx * s.w), x1 = Math.round(s.x + (fx + fw) * s.w);
  const y0 = Math.round(s.y + fy * s.h), y1 = Math.round(s.y + (fy + fh) * s.h);
  const g = Math.max(0, gap), h = g / 2;
  const l = fx <= 0 ? g : h, r = fx + fw >= 1 ? g : h, t = fy <= 0 ? g : h, b = fy + fh >= 1 ? g : h;
  return { x: x0 + l, y: y0 + t, w: Math.max(1, Math.round(x1 - x0 - l - r)), h: Math.max(1, Math.round(y1 - y0 - t - b)) };
}
export const zoneRect = (z: Zone, s: Rect, gap = 0): Rect => fracRect(ZONE_FRAC[z], s, gap);

const T = 1 / 3;
export const SNAP_LAYOUTS: SnapLayout[] = [
  { id: "halves", name: "Halves", zones: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { id: "thirds", name: "Thirds", zones: [[0, 0, T, 1], [T, 0, T, 1], [2 * T, 0, T, 1]] },
  { id: "twothirds", name: "2/3 + 1/3", zones: [[0, 0, 2 * T, 1], [2 * T, 0, T, 1]] },
  { id: "quarters", name: "Quarters", zones: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: "bigtwo", name: "1 big + 2 stacked", zones: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
];
export const layoutRects = (l: SnapLayout, s: Rect, gap = 0): Rect[] => l.zones.map((z) => fracRect(z, s, gap));

/** Snap Assist: pair the zones left after `placed` with candidate panel ids, in order. */
export function assistFill(zoneCount: number, placed: number, candidates: string[]): { zone: number; id: string }[] {
  const free = Array.from({ length: zoneCount }, (_, i) => i).filter((i) => i !== placed);
  return free.slice(0, candidates.length).map((zone, k) => ({ zone, id: candidates[k] }));
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0;

/** Shared divider: `id` went from `before` to `after`; neighbours whose edge touched a moved
 *  edge (within `tol`, overlapping along it) follow so the gap stays the same. */
export function resizeGroup(panels: { id: string; rect: Rect }[], id: string, before: Rect, after: Rect, tol = 12): { id: string; rect: Rect }[] {
  const out: { id: string; rect: Rect }[] = [];
  const bR = before.x + before.w, aR = after.x + after.w, bB = before.y + before.h, aB = after.y + after.h;
  for (const p of panels) {
    if (p.id === id) continue;
    let { x, y, w, h } = p.rect;
    const vOv = overlap(y, y + h, before.y, bB), hOv = overlap(x, x + w, before.x, bR);
    if (vOv && aR !== bR && Math.abs(x - bR) <= tol) { const gap = x - bR; w -= aR + gap - x; x = aR + gap; }
    else if (vOv && after.x !== before.x && Math.abs(x + w - before.x) <= tol) { const gap = before.x - (x + w); w = after.x - gap - x; }
    if (hOv && aB !== bB && Math.abs(y - bB) <= tol) { const gap = y - bB; h -= aB + gap - y; y = aB + gap; }
    else if (hOv && after.y !== before.y && Math.abs(y + h - before.y) <= tol) { const gap = before.y - (y + h); h = after.y - gap - y; }
    if (x !== p.rect.x || y !== p.rect.y || w !== p.rect.w || h !== p.rect.h) out.push({ id: p.id, rect: { x, y, w: Math.max(1, w), h: Math.max(1, h) } });
  }
  return out;
}

export type SnapPrefs = { on: boolean; gap: number };
export const SNAP_DEFAULT: SnapPrefs = { on: true, gap: 8 };
export function sanitizeSnap(raw: unknown): SnapPrefs {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const g = Number(o.gap);
  return { on: o.on !== false, gap: Number.isFinite(g) ? Math.min(32, Math.max(0, Math.round(g))) : SNAP_DEFAULT.gap };
}
