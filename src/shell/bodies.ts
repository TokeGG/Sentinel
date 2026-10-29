// Per-module body sprites, built once per (size bucket, dpr, hue, icon) and
// reused every frame; drawing one body is a handful of drawImage calls
// (back ring, albedo, rotated shade, glyph, front ring). No allocation.
import { lookOf, bucketR, type Look } from "./bodyKind";
import { paintAlbedo, paintGlyph, paintRing, paintShade } from "./bodyArt";
import type { Slot } from "./mapLayout";

export type Body = {
  key: string; rq: number; dpr: number; look: Look;
  albedo: HTMLCanvasElement; shade: HTMLCanvasElement; glyph: HTMLCanvasElement | null;
  ringB: HTMLCanvasElement | null; ringF: HTMLCanvasElement | null;
};
const HOVER = "rgba(255,255,255,0.85)";

/** Cached sprite set for slot `s`; `r` = its radius before perspective. Built for the nearest
 *  perspective size (x1.45) so a body never needs rebuilding as it orbits, and drawn scaled. */
export function body(prev: Body | undefined, s: Slot, r: number, dpr: number): Body {
  const rq = bucketR(r * 1.45), key = `${rq}|${dpr}|${s.hue}|${s.icon}|${s.ring}`;
  if (prev && prev.key === key) return prev;
  const look = lookOf(s.id, s.ring), rd = rq * dpr;
  const [ringB, ringF] = look.ringed ? paintRing(s.hue, rd) : [null, null];
  return { key, rq, dpr, look, albedo: paintAlbedo(look, s.hue, rd, dpr), shade: paintShade(rd), glyph: paintGlyph(s.icon, rd, dpr), ringB, ringF };
}

const put = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, x: number, y: number, k: number, dpr: number) => {
  const w = (c.width / dpr) * k;
  ctx.drawImage(c, x - w / 2, y - w / 2, w, w);
};

/** Back half of the ring (call before drawBody). */
export function drawRingBack(ctx: CanvasRenderingContext2D, b: Body, x: number, y: number, r: number) {
  if (b.ringB) put(ctx, b.ringB, x, y, r / b.rq, b.dpr);
}

/** The sphere, its lit side turned toward (sunX, sunY), glyph, front ring; hover adds a white ring. */
export function drawBody(ctx: CanvasRenderingContext2D, b: Body, x: number, y: number, r: number, sunX: number, sunY: number, hover: boolean) {
  const k = r / b.rq, d = b.dpr;
  put(ctx, b.albedo, x, y, k, d);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(sunY - y, sunX - x));
  const w = (b.shade.width / d) * k;
  ctx.drawImage(b.shade, -w / 2, -w / 2, w, w);
  ctx.restore();
  if (b.glyph) {
    ctx.globalAlpha = 0.85;
    put(ctx, b.glyph, x, y, k, d);
    ctx.globalAlpha = 1;
  }
  if (b.ringF) put(ctx, b.ringF, x, y, k, d);
  if (hover) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = HOVER;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}
