// Night-sky background: cached nebula + rotating, twinkling stars. Stars are a
// background, so they rotate about the canvas center, not the pan/zoom view.
import {
  makeStars, twinkle, alphaLevel, ROTATION_RATE, STAR_STYLES, GLOW_STYLES, type Star,
} from "./stars.ts";

export type Sky = { w: number; h: number; dpr: number; stars: Star[]; col: Uint8Array; bg: HTMLCanvasElement };

function makeBackground(w: number, h: number, dpr: number): HTMLCanvasElement {
  const bg = document.createElement("canvas");
  bg.width = Math.round(w * dpr);
  bg.height = Math.round(h * dpr);
  const ctx = bg.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#05070f";
  ctx.fillRect(0, 0, w, h);
  for (const [x, y, r, rgb, a] of [
    [0.3, 0.35, 0.6, "70,60,160", 0.16],
    [0.75, 0.7, 0.5, "30,100,150", 0.12],
  ] as const) {
    const g = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, Math.max(w, h) * r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return bg;
}

// Rebuilt only when the size or devicePixelRatio changes.
export function ensureSky(prev: Sky | null, w: number, h: number, dpr: number, count = 450): Sky {
  if (prev && prev.w === w && prev.h === h && prev.dpr === dpr) return prev;
  // Generate over the diagonal-sized square, keep the disc: rotation preserves
  // distance from the center, so stars outside it can never be visible.
  const d = Math.hypot(w, h), R = d / 2 + 4;
  const all = makeStars(20261028, Math.round((count * d * d) / (w * h)), d, d);
  const stars = all.filter((s) => Math.hypot(s.x - d / 2, s.y - d / 2) <= R);
  for (const s of stars) { s.x += (w - d) / 2; s.y += (h - d) / 2; }
  const col = Uint8Array.from(stars, (_, i) => ((i * 7) % 11 < 6 ? 0 : (i * 7) % 11 < 9 ? 1 : 2));
  return { w, h, dpr, stars, col, bg: makeBackground(w, h, dpr) };
}

const COS = [0, 0, 0], SIN = [0, 0, 0]; // one angle per depth layer, per frame
// `bg` lets the map pass a cached backdrop (sky.bg + orbit rings) instead.
export function drawSky(ctx: CanvasRenderingContext2D, sky: Sky, tSec: number, bg: HTMLCanvasElement = sky.bg) {
  const { w, h, stars, col } = sky;
  const cx = w / 2, cy = h / 2;
  ctx.drawImage(bg, 0, 0, w, h);
  for (let k = 0; k < 3; k++) {
    const a = tSec * ROTATION_RATE * (1 + k * 0.5);
    COS[k] = Math.cos(a);
    SIN[k] = Math.sin(a);
  }
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i], k = s.layer;
    const dx = s.x - cx, dy = s.y - cy;
    const x = cx + dx * COS[k] - dy * SIN[k], y = cy + dx * SIN[k] + dy * COS[k];
    if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
    const lv = alphaLevel(twinkle(s, tSec) * (0.7 + k * 0.15));
    if (k === 2 && s.r > 2.15) {
      ctx.fillStyle = GLOW_STYLES[col[i]][lv];
      ctx.beginPath();
      ctx.arc(x, y, s.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = STAR_STYLES[col[i]][lv];
    ctx.fillRect(x - s.r / 2, y - s.r / 2, s.r, s.r);
  }
}

// Sizes the backing store for DPR and resets the transform; null if unavailable.
export function prepCanvas(c: HTMLCanvasElement | null) {
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, dpr };
}
