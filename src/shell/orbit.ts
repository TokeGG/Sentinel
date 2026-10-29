// Pure solar-system orbits: a planet's position is a function of its orbit
// time alone. Time accumulation reuses `advance` from stars.ts.
import type { Ring } from "../core/module.ts";
import { advance } from "./stars.ts";

type Pt = { x: number; y: number };

/** World units, inner to outer. */
export const RING_RADIUS: Record<Ring, number> = { daily: 190, media: 300, system: 410, security: 520 };
/** Seconds per full turn at speed 1 (inner rings are faster). */
export const RING_PERIOD_S: Record<Ring, number> = { daily: 600, media: 780, system: 960, security: 1200 };

const TAU = Math.PI * 2;

/** Even spacing 2π·index/count; the angle advances 2π·speed·tSec/period.
 *  count ≤ 0 or any non-finite input returns the center. `out` (optional)
 *  is filled and returned instead of allocating, for the per-frame path. */
export function orbitPos(ring: Ring, index: number, count: number, tSec: number, speed: number, center: Pt, out?: Pt): Pt {
  const o = out ?? { x: 0, y: 0 };
  const period = RING_PERIOD_S[ring], r = RING_RADIUS[ring];
  if (!(count > 0) || ![index, count, tSec, speed, center.x, center.y].every(Number.isFinite) || !period) {
    o.x = center.x;
    o.y = center.y;
    return o;
  }
  const a = (TAU * index) / count + (TAU * speed * tSec) / period;
  o.x = center.x + r * Math.cos(a);
  o.y = center.y + r * Math.sin(a);
  return o;
}

/** Hover slow factor: exponential ease toward `target` that settles in
 *  about EASE_MS (snaps exactly once within 1% or after a long gap). */
export const EASE_MS = 300;
export function easeSlow(current: number, target: number, dtMs: number): number {
  if (!Number.isFinite(current)) return target;
  if (!(dtMs > 0)) return current;
  if (dtMs >= EASE_MS) return target;
  const next = current + (target - current) * (1 - Math.exp((-3 * dtMs) / EASE_MS));
  return Math.abs(target - next) < 0.01 ? target : next;
}

/** Orbit speed setting: 0.25..2, anything else falls back to 1. */
export const SPEED_MIN = 0.25, SPEED_MAX = 2;
export const clampSpeed = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(SPEED_MAX, Math.max(SPEED_MIN, v)) : 1;

/** Orbit clock: integral of clamped dt x speed, in orbit-seconds. Because the
 *  period is applied inside orbitPos, one clock serves every ring, and a speed
 *  change alters only the rate, never the position (no jump). */
export const stepRing = (clock: number, dtMs: number, speed: number): number =>
  clock + advance(0, dtMs, true) * clampSpeed(speed);

/** Hover lag is kept in orbit-seconds behind the ring slot. It relaxes toward
 *  0 at CATCHUP x the ring rate, so a catching-up planet runs at most 1.5x its
 *  ring's speed; it lands exactly on 0 and never overshoots. */
export const CATCHUP = 0.5;
export function relaxLag(lag: number, dtMs: number, ringRate: number): number {
  if (!Number.isFinite(lag)) return 0;
  const step = CATCHUP * Math.abs(ringRate) * advance(0, dtMs, true);
  if (!(step > 0)) return lag;
  return Math.abs(lag) <= step ? 0 : lag - Math.sign(lag) * step;
}

/** Slow-factor target for the hovered planet: 0 (hold) until the pointer has
 *  rested on it for HOLD_MS, then 1, so a resting mouse never freezes a planet.
 *  hoverMs < 0 means nothing is hovered. */
export const HOLD_MS = 4000;
export function holdTarget(hoverMs: number, pointerIdleMs: number): number {
  if (!(hoverMs >= 0)) return 1;
  return Math.min(hoverMs, pointerIdleMs) < HOLD_MS ? 0 : 1;
}
