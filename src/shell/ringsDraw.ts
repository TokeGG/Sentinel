// Orbit lines in 3D: each ring is a fixed polyline in its tilted plane,
// projected every frame (4 x 73 points). Inner rings (planets) are solid blue,
// outer rings (small bodies) are dashed amber, so the two groups read apart.
import type { Ring } from "../core/module.ts";
import { RING_RADIUS } from "./orbit.ts";
import { planeToWorld, project, type Proj, type V3 } from "./proj.ts";
import type { Scene, View } from "./mapLayout.ts";

const SEG = 72;
const RINGS: Ring[] = ["daily", "media", "system", "security"];
const UNIT = Float64Array.from({ length: SEG + 1 }, (_, i) => (i / SEG) * Math.PI * 2);
const COS = UNIT.map(Math.cos), SIN = UNIT.map(Math.sin);
const W: V3 = { x: 0, y: 0, z: 0 }, PR: Proj = { x: 0, y: 0, d: 0, k: 1 };
const DASH: number[] = [5, 7], SOLID: number[] = [];
const STYLE: Record<Ring, [string, number[]]> = {
  daily: ["rgba(140,175,255,0.30)", SOLID], media: ["rgba(140,175,255,0.24)", SOLID],
  system: ["rgba(255,196,128,0.20)", DASH], security: ["rgba(255,196,128,0.15)", DASH],
};

export function drawRings(ctx: CanvasRenderingContext2D, s: Scene, v: View) {
  ctx.lineWidth = 1;
  for (const ring of RINGS) {
    const R = RING_RADIUS[ring];
    ctx.strokeStyle = STYLE[ring][0];
    ctx.setLineDash(STYLE[ring][1]);
    ctx.beginPath();
    for (let i = 0; i <= SEG; i++) {
      planeToWorld(ring, R * COS[i], R * SIN[i], W);
      project(s.cam, W.x, W.y, W.z, PR);
      if (i === 0) ctx.moveTo(v.tx + PR.x * v.scale, v.ty + PR.y * v.scale);
      else ctx.lineTo(v.tx + PR.x * v.scale, v.ty + PR.y * v.scale);
    }
    ctx.stroke();
  }
  ctx.setLineDash(SOLID);
}
