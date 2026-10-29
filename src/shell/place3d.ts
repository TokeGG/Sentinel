// Pure 3D placement of the whole scene: each planet's orbit slot -> tilted ring
// plane -> camera/perspective -> screen position, radius and depth; then the
// far -> near draw order. Writes into the Scene's preallocated arrays.
import { orbitPos } from "./orbit.ts";
import { planeToWorld, project, type Proj, type V3 } from "./proj.ts";
import { sortFarToNear } from "./depth.ts";
import { BODY_SCALE, planetRadius, planetTime, sunRadius, type Scene, type View } from "./mapLayout.ts";

const ORIGIN = { x: 0, y: 0 }, P = { x: 0, y: 0 }, W: V3 = { x: 0, y: 0, z: 0 }, PR: Proj = { x: 0, y: 0, d: 0, k: 1 };

/** World origin (the sun) lands on view.tx/ty; fills sx, sy, sz, rad and order. */
export function placeScene(s: Scene, v: View) {
  const n = s.slots.length, base = planetRadius(v.scale);
  for (let i = 0; i < n; i++) {
    const sl = s.slots[i];
    if (sl.phase === undefined) orbitPos(sl.ring, sl.index, sl.count, planetTime(s, i), 1, ORIGIN, P);
    else orbitPos(sl.ring, sl.phase, 1, planetTime(s, i), 1, ORIGIN, P);
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
