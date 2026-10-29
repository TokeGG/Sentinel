// Paints one body's cached sprite layers onto offscreen canvases (device px).
// Layers: albedo (surface + atmosphere rim), shade (day/night terminator, lit
// from +x and rotated toward the sun at draw time), glyph, ring back/front.
import { drawIcon } from "./icons";
import { rng, type Look } from "./bodyKind";

const TAU = Math.PI * 2;
export const RING_TILT = -0.32, RING_FLAT = 0.34, RING_OUT = 1.9;
const mk = (px: number) => {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  return c;
};
const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };

export function paintAlbedo(look: Look, hue: number, rd: number, dpr: number): HTMLCanvasElement {
  const px = 2 * Math.ceil(rd * 1.22) + 2, m = px / 2, c = mk(px), g = c.getContext("2d")!, rand = rng(look.seed);
  const sat = look.kind === "rocky" && !look.atmosphere ? 18 : 52;
  if (look.atmosphere) {
    const h = g.createRadialGradient(m, m, rd * 0.9, m, m, rd * 1.2);
    h.addColorStop(0, `hsla(${hue} 85% 70% / 0.5)`);
    h.addColorStop(1, `hsla(${hue} 85% 65% / 0)`);
    g.fillStyle = h;
    disc(g, m, m, rd * 1.2);
    g.fill();
  }
  g.save();
  disc(g, m, m, rd);
  g.clip();
  g.fillStyle = `hsl(${hue} ${sat}% ${look.kind === "ocean" ? 34 : 42}%)`;
  g.fillRect(0, 0, px, px);
  if (look.kind === "gas") {
    for (let k = 0; k < 11; k++) {
      g.fillStyle = `hsla(${hue + (rand() - 0.5) * 30} ${sat + rand() * 20}% ${30 + rand() * 38}% / ${0.25 + rand() * 0.35})`;
      g.fillRect(0, m - rd + rand() * 2 * rd, px, rd * (0.05 + rand() * 0.2));
    }
    g.fillStyle = `hsla(${hue + 20} 60% 78% / 0.55)`;
    g.beginPath();
    g.ellipse(m - rd * 0.25, m + rd * 0.28, rd * 0.2, rd * 0.1, 0, 0, TAU);
    g.fill();
  } else {
    const n = look.kind === "ocean" ? 9 : 16;
    for (let k = 0; k < n; k++) {
      const x = m + (rand() - 0.5) * 1.8 * rd, y = m + (rand() - 0.5) * 1.8 * rd, r = rd * (0.08 + rand() * 0.28);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const land = look.kind === "ocean";
      grad.addColorStop(0, land ? `hsla(${hue + 95} 40% 42% / 0.8)` : `hsla(${hue} ${sat}% ${22 + rand() * 12}% / 0.55)`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      disc(g, x, y, r);
      g.fill();
    }
    if (look.kind === "ocean") {
      g.fillStyle = "rgba(255,255,255,0.3)";
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.ellipse(m + (rand() - 0.5) * 1.5 * rd, m + (rand() - 0.5) * 1.5 * rd, rd * (0.18 + rand() * 0.3), rd * 0.05, rand() * 0.6, 0, TAU);
        g.fill();
      }
    } else {
      g.lineWidth = Math.max(1, dpr * 0.8);
      g.strokeStyle = "rgba(255,255,255,0.14)";
      for (let k = 0; k < 7; k++) { disc(g, m + (rand() - 0.5) * 1.5 * rd, m + (rand() - 0.5) * 1.5 * rd, rd * (0.05 + rand() * 0.09)); g.stroke(); }
    }
  }
  g.restore();
  return c;
}

/** Light comes from +x: bright limb on the right, soft terminator, dark far side. */
export function paintShade(rd: number): HTMLCanvasElement {
  const px = 2 * Math.ceil(rd) + 2, m = px / 2, c = mk(px), g = c.getContext("2d")!;
  const l = g.createRadialGradient(m + rd * 0.45, m - rd * 0.1, rd * 0.05, m + rd * 0.2, m, rd * 1.7);
  l.addColorStop(0, "rgba(255,255,255,0.32)");
  l.addColorStop(0.3, "rgba(255,255,255,0)");
  l.addColorStop(0.62, "rgba(2,4,14,0.5)");
  l.addColorStop(1, "rgba(2,4,14,0.9)");
  g.fillStyle = l;
  disc(g, m, m, rd);
  g.fill();
  return c;
}

export function paintGlyph(icon: string | undefined, rd: number, dpr: number): HTMLCanvasElement | null {
  if (!icon) return null;
  const s = Math.ceil(rd * 1.2), c = mk(2 * s), g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  drawIcon(g, icon, s / dpr, s / dpr, (rd / dpr) * 0.95, "#ffffff");
  return c;
}

/** Saturn-like ring halves: back (drawn before the body) and front (after). */
export function paintRing(hue: number, rd: number): [HTMLCanvasElement, HTMLCanvasElement] {
  const px = 2 * Math.ceil(rd * RING_OUT) + 4, m = px / 2;
  const half = (from: number, to: number) => {
    const c = mk(px), g = c.getContext("2d")!;
    for (const [f, w, a] of [[1.45, 0.12, 0.5], [1.62, 0.06, 0.3], [1.78, 0.14, 0.42]] as const) {
      g.strokeStyle = `hsla(${hue + 12} 35% 78% / ${a})`;
      g.lineWidth = rd * w;
      g.beginPath();
      g.ellipse(m, m, rd * f, rd * f * RING_FLAT, RING_TILT, from, to);
      g.stroke();
    }
    return c;
  };
  return [half(Math.PI, TAU), half(0, Math.PI)];
}
