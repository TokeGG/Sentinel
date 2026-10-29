// Pure 3D for the star map: orbit-plane point -> ring tilt (inclination, node,
// eccentricity) -> camera (yaw, pitch) -> perspective. World units, y down.
// Depth `d` is distance from the camera plane: bigger = farther.
import type { Ring } from "../core/module.ts";

export const FOCAL = 1800; // perspective strength (camera distance, world units)
export const PITCH = 0.95; // rad above the ring plane (π/2 = straight down)
export type Cam = { yaw: number; pitch: number; cy: number; sy: number; cp: number; sp: number };
export type V3 = { x: number; y: number; z: number };
export type Proj = { x: number; y: number; d: number; k: number }; // x,y: unscaled world, k: perspective scale

/** Per-ring plane tilt (rad), ascending node (rad), and minor/major axis ratio. */
export const RING_SHAPE: Record<Ring, { inc: number; node: number; ecc: number }> = {
  daily: { inc: 0.07, node: 0.4, ecc: 0.94 },
  media: { inc: -0.11, node: 2.1, ecc: 0.9 },
  system: { inc: 0.15, node: 4.0, ecc: 0.92 },
  security: { inc: -0.09, node: 5.3, ecc: 0.88 },
};

export function setCam(c: Cam, yaw: number, pitch: number): Cam {
  c.yaw = yaw;
  c.pitch = pitch;
  c.cy = Math.cos(yaw);
  c.sy = Math.sin(yaw);
  c.cp = Math.cos(pitch);
  c.sp = Math.sin(pitch);
  return c;
}
export const makeCam = (yaw = 0, pitch = PITCH): Cam => setCam({ yaw: 0, pitch: 0, cy: 1, sy: 0, cp: 1, sp: 0 }, yaw, pitch);

const RINGS = Object.keys(RING_SHAPE) as Ring[];
// Rodrigues rotation about the horizontal axis (cos node, 0, sin node), precomputed per ring.
const TRIG = Object.fromEntries(RINGS.map((r) => {
  const { inc, node } = RING_SHAPE[r];
  return [r, { c: Math.cos(inc), s: Math.sin(inc), nx: Math.cos(node), nz: Math.sin(node) }];
})) as Record<Ring, { c: number; s: number; nx: number; nz: number }>;

/** Plane coords (u,v) of ring `ring` (as from orbitPos) -> 3D world point:
 *  squash v by the ring's eccentricity, then tilt the plane about its node axis. */
export function planeToWorld(ring: Ring, u: number, v: number, out: V3): V3 {
  const t = TRIG[ring], w = v * RING_SHAPE[ring].ecc, dot = (u * t.nx + w * t.nz) * (1 - t.c);
  out.x = u * t.c + t.nx * dot;
  out.y = (u * t.nz - w * t.nx) * t.s;
  out.z = w * t.c + t.nz * dot;
  return out;
}

/** Camera + perspective. Never returns NaN for finite input. */
export function project(c: Cam, x: number, y: number, z: number, out: Proj): Proj {
  const x3 = x * c.cy + z * c.sy, z3 = -x * c.sy + z * c.cy;
  const d = y * c.sp - z3 * c.cp;
  const k = FOCAL / Math.max(FOCAL + d, FOCAL * 0.2);
  out.x = x3 * k;
  out.y = (y * c.cp + z3 * c.sp) * k;
  out.d = d;
  out.k = k;
  return out;
}
