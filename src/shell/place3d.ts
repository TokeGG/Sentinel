// Pure 3D placement of the whole scene: each planet's orbit slot -> tilted ring
// plane -> camera/perspective -> screen position, radius and depth; then the
// far -> near draw order. Writes into the Scene's preallocated arrays.
import { orbitPos } from "./orbit.ts";
import { planeToWorld, project, setCam, PITCH, type Proj, type V3 } from "./proj.ts";
import { sortFarToNear } from "./depth.ts";
import { BODY_SCALE, planetRadius, planetTime, sunRadius, type Scene, type View } from "./mapLayout.ts";

const ORIGIN = { x: 0, y: 0 }, P = { x: 0, y: 0 }, W: V3 = { x: 0, y: 0, z: 0 }, PR: Proj = { x: 0, y: 0, d: 0, k: 1 };
const PARALLAX_YAW = 0.12, PARALLAX_PITCH = 0.06, CAM_EASE_MS = 450;

/** World origin (the sun) lands on view.tx/ty; fills sx, sy, sz, rad and order. */
export function placeScene(s: Scene, v: View) {
  const n = s.slots.length, base = planetRadius(v.scale);
  for (let i = 0; i < n; i++) {
    const sl = s.slots[i];
    orbitPos(sl.ring, sl.index, sl.count, planetTime(s, i), 1, ORIGIN, P);
    planeToWorld(sl.ring, P.x, P.y, W);
    project(s.cam, W.x, W.y, W.z, PR);
    s.sx[i] = v.tx + PR.x * v.scale;
    s.sy[i] = v.ty + PR.y * v.scale;
    s.sz[i] = PR.d;
    s.rad[i] = base * BODY_SCALE[sl.ring] * PR.k;
  }
  s.sx[n] = v.tx;
  s.sy[n] = v.ty;
  s.sz[n] = 0;
  s.rad[n] = sunRadius(v.scale);
  sortFarToNear(s.order, s.sz);
}

/** Ease the camera toward the pointer-parallax target (px, py in -1..1). dtMs 0 leaves it as is. */
export function stepCam(s: Scene, dtMs: number) {
  if (!(dtMs > 0)) return;
  const c = s.cam, f = 1 - Math.exp(-dtMs / CAM_EASE_MS);
  let yaw = c.yaw + (s.px * PARALLAX_YAW - c.yaw) * f, pitch = c.pitch + (PITCH + s.py * PARALLAX_PITCH - c.pitch) * f;
  if (Math.abs(yaw - s.px * PARALLAX_YAW) < 1e-4) yaw = s.px * PARALLAX_YAW;
  if (Math.abs(pitch - PITCH - s.py * PARALLAX_PITCH) < 1e-4) pitch = PITCH + s.py * PARALLAX_PITCH;
  if (yaw !== c.yaw || pitch !== c.pitch) setCam(c, yaw, pitch);
}
