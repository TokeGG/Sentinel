// Cached planet/sun sprites: gradient disc + white glyph rendered once into an
// offscreen canvas per planet, redrawn only when its device-pixel size, hue or
// icon changes (zoom, dpr). A frame is then one unscaled drawImage per planet.
import { drawIcon } from "./icons";

export type Sprite = { c: HTMLCanvasElement; px: number; hue: number; icon?: string; dpr: number };
const TAU = Math.PI * 2;

/** Sprite for a disc of CSS radius `r` (plus a `glow` x r halo for the sun). */
export function sprite(prev: Sprite | undefined, hue: number, r: number, dpr: number, icon?: string, glow = 0): Sprite {
  const px = 2 * Math.ceil((r + Math.ceil(r * glow) + 2) * dpr); // even, whole device pixels
  if (prev && prev.px === px && prev.hue === hue && prev.icon === icon && prev.dpr === dpr) return prev;
  const c = prev?.c ?? document.createElement("canvas");
  c.width = c.height = px; // also clears a reused canvas
  const g = c.getContext("2d")!;
  const m = px / 2, rd = r * dpr;
  if (glow) {
    const h = g.createRadialGradient(m, m, rd * 0.6, m, m, m);
    h.addColorStop(0, `hsla(${hue} 95% 65% / 0.45)`);
    h.addColorStop(1, `hsla(${hue} 95% 60% / 0)`);
    g.fillStyle = h;
    g.fillRect(0, 0, px, px);
  }
  const d = g.createRadialGradient(m - rd * 0.35, m - rd * 0.35, rd * 0.1, m, m, rd);
  d.addColorStop(0, glow ? `hsl(${hue} 100% 80%)` : `hsl(${hue} 70% 62%)`);
  d.addColorStop(1, glow ? `hsl(${hue - 15} 90% 42%)` : `hsl(${hue} 55% 20%)`);
  g.fillStyle = d;
  g.beginPath();
  g.arc(m, m, rd, 0, TAU);
  g.fill();
  if (icon) {
    g.scale(dpr, dpr);
    drawIcon(g, icon, m / dpr, m / dpr, r * 1.15, "#ffffff");
  }
  return { c, px, hue, icon, dpr };
}

/** One planet (or the sun) centered at screen (x, y), snapped to device
 *  pixels so the blit is a plain copy; hover adds a white ring. */
export function drawPlanet(ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, r: number, hover: boolean) {
  const d = sp.dpr, half = sp.px / 2;
  ctx.drawImage(sp.c, Math.round(x * d - half) / d, Math.round(y * d - half) / d, sp.px / d, sp.px / d);
  if (hover) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, TAU);
    ctx.stroke();
  }
}
