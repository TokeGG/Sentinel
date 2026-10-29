// Pure planet drag: screen point -> nearest ring + plane angle (sampled through the
// same projection placeScene uses), and the phase override that makes a dropped
// planet keep orbiting from where it was dropped. Overrides live in app_settings
// `planet_pos` as { [moduleId]: { ring, phase } }.
import type { Ring } from "../core/module.ts";
import { RING_PERIOD_S, RING_RADIUS } from "./orbit.ts";
import { planeToWorld, project, type Cam, type Proj, type V3 } from "./proj.ts";
import { RING_PHASE, type View } from "./mapLayout.ts";

export type PlanetPos = Record<string, { ring: Ring; phase: number }>;
export const DRAG_PX = 4; // a press that moved less than this is a click
const RINGS: Ring[] = ["daily", "media", "system", "security"];
const SAMPLES = 180, TAU = Math.PI * 2;
const W: V3 = { x: 0, y: 0, z: 0 }, PR: Proj = { x: 0, y: 0, d: 0, k: 1 };

export const isDrag = (dx: number, dy: number): boolean => Math.hypot(dx, dy) >= DRAG_PX;

/** Ring and plane angle (rad) whose projected point is closest to screen (x, y). */
export function nearestRingPoint(cam: Cam, v: View, x: number, y: number): { ring: Ring; angle: number; dist: number } {
  let best = { ring: RINGS[0], angle: 0, dist: Infinity };
  for (const ring of RINGS) {
    const r = RING_RADIUS[ring];
    for (let i = 0; i < SAMPLES; i++) {
      const a = (i / SAMPLES) * TAU;
      planeToWorld(ring, r * Math.cos(a), r * Math.sin(a), W);
      project(cam, W.x, W.y, W.z, PR);
      const d = Math.hypot(v.tx + PR.x * v.scale - x, v.ty + PR.y * v.scale - y);
      if (d < best.dist) best = { ring, angle: a, dist: d };
    }
  }
  return best;
}

/** Phase (0..1) so that orbitPos(ring, phase, 1, orbitT + RING_PHASE·period) lands on `angle` now. */
export function phaseFor(ring: Ring, angle: number, orbitT: number): number {
  const p = RING_PERIOD_S[ring], t = orbitT + RING_PHASE[ring] * p;
  const f = angle / TAU - t / p;
  return ((f % 1) + 1) % 1;
}

/** Parse the stored JSON; drops malformed entries. */
export function parsePlanetPos(raw: string | null): PlanetPos {
  let o: unknown;
  try { o = raw ? JSON.parse(raw) : {}; } catch { return {}; }
  const out: PlanetPos = {};
  if (!o || typeof o !== "object") return out;
  for (const [id, e] of Object.entries(o as Record<string, any>)) {
    if (e && RINGS.includes(e.ring) && typeof e.phase === "number" && Number.isFinite(e.phase)) out[id] = { ring: e.ring, phase: ((e.phase % 1) + 1) % 1 };
  }
  return out;
}
