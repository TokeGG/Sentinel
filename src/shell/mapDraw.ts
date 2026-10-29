// Draws the 3D solar system in SCREEN space: sky, orbit lines, then the sun and
// every planet far -> near (moons' back half, ring back, body, ring front,
// moons' front half), then labels and badges on top. Sprites are cached
// (bodies.ts, sunDraw.ts); no per-frame allocation.
import { BODY_SCALE, planetRadius, type Scene, type View } from "./mapLayout";
import { SUN } from "./mapHit";
import { body, drawBody, drawRingBack, type Body } from "./bodies";
import { drawSun } from "./sunDraw";
import { drawRings } from "./ringsDraw";
import { drawLabels } from "./labelDraw";
import { drawBadges, drawMoons, drawSunGlow } from "./moonDraw";
import { getMotion } from "./motionStore";

export type Sprites = { planets: (Body | undefined)[] };

export function drawScene(ctx: CanvasRenderingContext2D, s: Scene, v: View, dpr: number, sp: Sprites, w: number, h: number) {
  const n = s.slots.length, sx = s.sx[n], sy = s.sy[n], base = planetRadius(v.scale);
  drawRings(ctx, s, v);
  drawSunGlow(ctx, s);
  for (let k = 0; k <= n; k++) {
    const i = s.order[k];
    if (i === n) {
      drawSun(ctx, sx, sy, s.rad[n], dpr, getMotion().starMotion ? s.starT : 0, s.hover === SUN);
      continue;
    }
    const b = (sp.planets[i] = body(sp.planets[i], s.slots[i], base * BODY_SCALE[s.slots[i].ring], dpr)), x = s.sx[i], y = s.sy[i], r = s.rad[i];
    drawMoons(ctx, s, i, true);
    drawRingBack(ctx, b, x, y, r);
    drawBody(ctx, b, x, y, r, sx, sy, i === s.hover);
    drawMoons(ctx, s, i, false);
  }
  drawLabels(ctx, s, w, h);
  drawBadges(ctx, s);
}
