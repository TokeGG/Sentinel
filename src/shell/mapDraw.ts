// Draws the solar system in SCREEN space: a cached backdrop (sky nebula +
// orbit rings, rebuilt only when the view or canvas changes), then the sun
// and every planet at its current position (placeScene) with its label.
// No per-frame allocation: sprites are cached, styles are constants.
import { RING_RADIUS } from "./orbit";
import type { Scene, View } from "./mapLayout";
import { SUN } from "./mapHit";
import { drawPlanet, sprite, type Sprite } from "./Planet";
import type { Sky } from "./Sky";
import { drawMoons, drawSunGlow } from "./moonDraw";

export type Sprites = { planets: (Sprite | undefined)[]; sun?: Sprite; back?: Backdrop };
type Backdrop = { c: HTMLCanvasElement; sky: Sky; tx: number; ty: number; scale: number };

const TAU = Math.PI * 2;
const RADII = [RING_RADIUS.daily, RING_RADIUS.media, RING_RADIUS.system, RING_RADIUS.security];
const FONT = "400 12px Inter, Avenir, Helvetica, Arial, sans-serif";
const FONT_HOVER = "600 12px Inter, Avenir, Helvetica, Arial, sans-serif";
const SUN_HUE = 42;

/** sky.bg with the orbit rings stroked on top; pass the result to drawSky. */
export function backdrop(sp: Sprites, sky: Sky, v: View): HTMLCanvasElement {
  const b = sp.back;
  if (b && b.sky === sky && b.tx === v.tx && b.ty === v.ty && b.scale === v.scale) return b.c;
  const c = b?.c ?? document.createElement("canvas");
  if (c.width !== sky.bg.width || c.height !== sky.bg.height) {
    c.width = sky.bg.width;
    c.height = sky.bg.height;
  }
  const g = c.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(sky.bg, 0, 0);
  g.setTransform(sky.dpr, 0, 0, sky.dpr, 0, 0);
  g.lineWidth = 1;
  g.strokeStyle = "rgba(150,170,230,0.16)";
  g.beginPath();
  for (let k = 0; k < RADII.length; k++) {
    const rr = RADII[k] * v.scale;
    g.moveTo(v.tx + rr, v.ty);
    g.arc(v.tx, v.ty, rr, 0, TAU);
  }
  g.stroke();
  sp.back = { c, sky, tx: v.tx, ty: v.ty, scale: v.scale };
  return c;
}

export function drawScene(ctx: CanvasRenderingContext2D, s: Scene, dpr: number, sp: Sprites) {
  sp.sun = sprite(sp.sun, SUN_HUE, s.sunR, dpr, "core", 0.9);
  drawSunGlow(ctx, s);
  drawPlanet(ctx, sp.sun, s.sunX, s.sunY, s.sunR, s.hover === SUN);
  for (let i = 0; i < s.slots.length; i++) {
    const p = (sp.planets[i] = sprite(sp.planets[i], s.slots[i].hue, s.r, dpr, s.slots[i].icon));
    drawPlanet(ctx, p, s.sx[i], s.sy[i], s.r, i === s.hover);
  }
  ctx.font = FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#aab3cf";
  for (let i = 0; i < s.slots.length; i++) {
    if (i !== s.hover) ctx.fillText(s.slots[i].name, s.sx[i], s.sy[i] + s.r + 5);
  }
  if (s.hover >= 0) {
    ctx.font = FONT_HOVER;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(s.slots[s.hover].name, s.sx[s.hover], s.sy[s.hover] + s.r + 5);
  }
  drawMoons(ctx, s);
}
