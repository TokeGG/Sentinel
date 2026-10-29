export type Rect = { x: number; y: number; w: number; h: number };
type Size = { w: number; h: number };

const STEP = 32;
const num = (n: number) => (Number.isFinite(n) ? n : 0);
const nonNeg = (n: number) => Math.max(0, num(n));

export function clampToScreen(r: Rect, screen: Rect, min: Size): Rect {
  const sw = nonNeg(screen.w);
  const sh = nonNeg(screen.h);
  const w = Math.min(Math.max(num(r.w), nonNeg(min.w)), sw);
  const h = Math.min(Math.max(num(r.h), nonNeg(min.h)), sh);
  const x = Math.min(Math.max(num(r.x), screen.x), screen.x + sw - w);
  const y = Math.min(Math.max(num(r.y), screen.y), screen.y + sh - h);
  return { x, y, w, h };
}

// Row-major grid filling the screen; a short last row stretches to full width.
export function tile(count: number, screen: Rect): Rect[] {
  const n = Math.floor(num(count));
  if (n <= 0) return [];
  const sw = nonNeg(screen.w);
  const sh = nonNeg(screen.h);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols);
    const y0 = Math.round((r * sh) / rows);
    const y1 = Math.round(((r + 1) * sh) / rows);
    for (let c = 0; c < inRow; c++) {
      const x0 = Math.round((c * sw) / inRow);
      const x1 = Math.round(((c + 1) * sw) / inRow);
      out.push({ x: screen.x + x0, y: screen.y + y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  return out;
}

export function cascade(index: number, screen: Rect, size: Size): Rect {
  const sw = nonNeg(screen.w);
  const sh = nonNeg(screen.h);
  const w = Math.min(nonNeg(size.w), sw);
  const h = Math.min(nonNeg(size.h), sh);
  const room = Math.min(sw - w, sh - h);
  const slots = Math.floor(room / STEP) + 1;
  const i = Math.max(0, Math.floor(num(index)));
  const off = ((i + 1) % slots) * STEP;
  return { x: screen.x + off, y: screen.y + off, w, h };
}

// Pointer-drag math for the panel chrome (Task 9b). Deltas are screen px.
export function dragRect(start: Rect, dx: number, dy: number, screen: Rect, min: Size): Rect {
  return clampToScreen({ ...start, x: num(start.x) + num(dx), y: num(start.y) + num(dy) }, screen, min);
}
// Resize never moves the origin: size >= min, then capped to the room left
// at the current origin (so min itself is capped when it cannot fit).
export function resizeRect(start: Rect, dx: number, dy: number, screen: Rect, min: Size): Rect {
  const x = num(start.x);
  const y = num(start.y);
  const roomW = nonNeg(screen.x + nonNeg(screen.w) - x);
  const roomH = nonNeg(screen.y + nonNeg(screen.h) - y);
  const w = Math.min(Math.max(num(start.w) + num(dx), nonNeg(min.w)), roomW);
  const h = Math.min(Math.max(num(start.h) + num(dy), nonNeg(min.h)), roomH);
  return { x, y, w, h };
}

/** Height of the custom title bar (frameless main window); keep in sync with --titlebar-h in ui/tokens.css. */
export const TITLEBAR_H = 32;

/**
 * Area panels may occupy: the logical client rect minus the title bar band at
 * the top (the window has no native frame, so client area == whole window).
 * Falls back when the measurement is unusable.
 */
export function clientRect(physW: number, physH: number, scale: number, fallback: Rect, top = 0): Rect {
  const ok = [physW, physH, scale].every((n) => Number.isFinite(n) && n > 0);
  if (!ok) return fallback;
  const t = Math.min(Math.max(num(top), 0), physH / scale);
  return { x: 0, y: t, w: physW / scale, h: physH / scale - t };
}

/** Panels outside `screen` (after maximise/restore/resize) -> the rects to apply; unchanged ones are omitted. */
export function reclamp(panels: { id: string; rect: Rect; min: Size }[], screen: Rect): { id: string; rect: Rect }[] {
  const out: { id: string; rect: Rect }[] = [];
  for (const p of panels) {
    const rect = clampToScreen(p.rect, screen, p.min);
    if (["x", "y", "w", "h"].some((k) => rect[k as keyof Rect] !== p.rect[k as keyof Rect])) out.push({ id: p.id, rect });
  }
  return out;
}
