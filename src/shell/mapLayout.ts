// Pure solar-system scene: ring slots for the registry, ONE shared orbit clock
// (per-ring angles come from orbitPos' period), a per-planet hover lag that
// relaxes back to the evenly spaced slot, screen placement and the fit view.
// Typed arrays are allocated once per registry change, never per frame.
import { ringOf, type ModuleManifest, type Ring } from "../core/module.ts";
import { hashId, hueOf } from "./hue.ts";
import { orbitPos, easeSlow, clampSpeed, stepRing, relaxLag, holdTarget, RING_RADIUS, RING_PERIOD_S } from "./orbit.ts";
import { advance } from "./stars.ts";

export type Slot = { id: string; name: string; ring: Ring; index: number; count: number; hue: number; icon?: string };
export type Scene = {
  slots: Slot[];
  orbitT: number; // shared orbit clock, orbit-seconds (stepRing: integral of dt x speed)
  lag: Float64Array; // per planet: orbit-seconds behind its ring slot (hover), relaxes to 0
  slow: Float64Array; // hover slow factor: 1 = full speed, 0 = stopped
  sx: Float64Array; // current screen position, written by placeScene
  sy: Float64Array;
  starT: number; // star-field time, seconds
  hover: number; // planet index, SUN (-2) or -1
  hoverMs: number; idleMs: number; // time on the current hover target / since the pointer last moved
  sunX: number; sunY: number; sunR: number; r: number; // r = planet screen radius
};
export type Layers = { stars: boolean; orbit: boolean; speed: number };
export type View = { tx: number; ty: number; scale: number };

const RINGS: Ring[] = ["daily", "media", "system", "security"];
type Meta = Pick<ModuleManifest, "id" | "name" | "ring" | "icon" | "accent">;

/** Ring by ring (inner first), registry order inside a ring. */
export function buildSlots(mods: Meta[]): Slot[] {
  return RINGS.flatMap((ring) => {
    const on = mods.filter((m) => ringOf(m) === ring);
    return on.map((m, index) => ({
      id: m.id, name: m.name, ring, index, count: on.length, icon: m.icon,
      hue: (m.accent ? hueOf(m.accent) : null) ?? hashId(m.id) % 360,
    }));
  });
}

/** Starting phase per ring (fraction of a turn), so rings' first planets
 *  do not all start lined up on the same ray. */
export const RING_PHASE: Record<Ring, number> = { daily: 0, media: 0.25, system: 1 / 12, security: 0.375 };

/** The clock and each planet's lag (by id) survive a registry change. */
export function makeScene(slots: Slot[], prev?: Scene | null): Scene {
  const n = slots.length, lag = new Float64Array(n);
  if (prev) slots.forEach((s, i) => { const j = prev.slots.findIndex((p) => p.id === s.id); if (j >= 0) lag[i] = prev.lag[j]; });
  return {
    slots, orbitT: prev?.orbitT ?? 0, lag, slow: new Float64Array(n).fill(1), sx: new Float64Array(n), sy: new Float64Array(n),
    starT: prev?.starT ?? 0, hover: -1, hoverMs: 0, idleMs: 0, sunX: 0, sunY: 0, sunR: 0, r: 0,
  };
}

/** Orbit time fed to orbitPos for planet i: shared clock + ring phase - lag. */
export const planetTime = (s: Scene, i: number): number =>
  s.orbitT + RING_PHASE[s.slots[i].ring] * RING_PERIOD_S[s.slots[i].ring] - s.lag[i];

/** One animation step. A disabled layer never advances. While slowed, a
 *  planet's lag grows by what its ring moved; once released it relaxes back. */
export function stepScene(s: Scene, dtMs: number, layers: Layers) {
  const dts = advance(0, dtMs, true); // clamped like the star clock
  if (layers.stars) s.starT += dts;
  if (!layers.orbit) return;
  s.hoverMs += dts * 1000;
  s.idleMs += dts * 1000;
  const prev = s.orbitT, speed = clampSpeed(layers.speed);
  s.orbitT = stepRing(prev, dtMs, speed);
  const d = s.orbitT - prev, hold = holdTarget(s.hover >= 0 ? s.hoverMs : -1, s.idleMs);
  for (let i = 0; i < s.lag.length; i++) {
    const target = i === s.hover ? hold : 1;
    s.slow[i] = easeSlow(s.slow[i], target, dtMs);
    s.lag[i] += d * (1 - s.slow[i]);
    if (target === 1) s.lag[i] = relaxLag(s.lag[i], dtMs, speed);
  }
}

export const PLANET_R = 34, SUN_R = 46; // world units
export const planetRadius = (scale: number) => Math.max(14, PLANET_R * scale);
export const sunRadius = (scale: number) => Math.max(20, SUN_R * scale);

const ORIGIN = { x: 0, y: 0 }, P = { x: 0, y: 0 }; // reused scratch
/** World origin is the sun; writes screen positions into s.sx/s.sy. */
export function placeScene(s: Scene, v: View) {
  s.sunX = v.tx;
  s.sunY = v.ty;
  s.sunR = sunRadius(v.scale);
  s.r = planetRadius(v.scale);
  for (let i = 0; i < s.slots.length; i++) {
    const sl = s.slots[i];
    orbitPos(sl.ring, sl.index, sl.count, planetTime(s, i), 1, ORIGIN, P);
    s.sx[i] = v.tx + P.x * v.scale;
    s.sy[i] = v.ty + P.y * v.scale;
  }
}

/** Outer ring radius in world units; labels/planets are sized in screen px. */
export const OUTER_EXTENT = RING_RADIUS.security;
const HUD = 56, PAD = 62; // top strip kept for the HUD; planet + label margin

/** Default view: the whole system (outer ring + labels) centered in the canvas. */
export function fitView(w: number, h: number): View {
  const avail = Math.min(w, h - HUD) / 2 - PAD;
  const scale = Math.max(0.05, avail / OUTER_EXTENT) || 1;
  return { scale, tx: w / 2, ty: HUD + (h - HUD) / 2 };
}
