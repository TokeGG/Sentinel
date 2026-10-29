// Pure solar-system scene: ring slots for the registry, ONE shared orbit clock
// (per-ring angles come from orbitPos' period), a per-planet hover lag that
// relaxes back to the evenly spaced slot, screen placement and the fit view.
// Typed arrays are allocated once per registry change, never per frame.
import { ringOf, type ModuleManifest, type Ring } from "../core/module.ts";
import { hashId, hueOf } from "./hue.ts";
import { easeSlow, clampSpeed, stepRing, relaxLag, holdTarget, RING_PERIOD_S, RING_RADIUS } from "./orbit.ts";
import { advance } from "./stars.ts";
import { makeCam, planeToWorld, project, type Cam, type Proj, type V3 } from "./proj.ts";
import { makeLabelSet, type LabelSet } from "./labels.ts";

export type Slot = { id: string; name: string; ring: Ring; index: number; count: number; hue: number; icon?: string; phase?: number };
export type Scene = {
  slots: Slot[];
  orbitT: number; // shared orbit clock, orbit-seconds (stepRing: integral of dt x speed)
  lag: Float64Array; // per planet: orbit-seconds behind its ring slot (hover), relaxes to 0
  slow: Float64Array; // hover slow factor: 1 = full speed, 0 = stopped
  // Parallel per-body arrays, length n+1: planets 0..n-1, the SUN at index n. Written by placeScene.
  sx: Float64Array; sy: Float64Array; // screen position
  sz: Float64Array; // depth (bigger = farther; sun 0)
  rad: Float64Array; // screen radius after ring size and perspective
  order: Int32Array; // body indices far -> near (depth sorted)
  cam: Cam; // fixed camera (no pointer parallax)
  labels: LabelSet;
  starT: number; // star-field time, seconds
  hover: number; // planet index, SUN (-2) or -1
  hoverMs: number; idleMs: number; // time on the current hover target / since the pointer last moved
};
export type Layers = { stars: boolean; orbit: boolean; speed: number };
export type View = { tx: number; ty: number; scale: number };

const RINGS: Ring[] = ["daily", "media", "system", "security"];
type Meta = Pick<ModuleManifest, "id" | "name" | "ring" | "icon" | "accent">;

/** Ring by ring (inner first), registry order inside a ring. `pos` (dragged planets)
 *  overrides a module's ring and gives it a fixed phase instead of an even slot. */
export function buildSlots(mods: Meta[], pos: Record<string, { ring: Ring; phase: number }> = {}): Slot[] {
  return RINGS.flatMap((ring) => {
    const on = mods.filter((m) => (pos[m.id]?.ring ?? ringOf(m)) === ring);
    return on.map((m, index) => ({
      id: m.id, name: m.name, ring, index, count: on.length, icon: m.icon, ...(pos[m.id] ? { phase: pos[m.id].phase } : {}),
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
    slots, orbitT: prev?.orbitT ?? 0, lag, slow: new Float64Array(n).fill(1),
    sx: new Float64Array(n + 1), sy: new Float64Array(n + 1), sz: new Float64Array(n + 1), rad: new Float64Array(n + 1),
    order: Int32Array.from({ length: n + 1 }, (_, i) => i), cam: makeCam(), labels: makeLabelSet(n),
    starT: prev?.starT ?? 0, hover: -1, hoverMs: 0, idleMs: 0,
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
/** Size of a ring's bodies relative to PLANET_R: inner rings planets, outer rings smaller bodies. */
export const BODY_SCALE: Record<Ring, number> = { daily: 1, media: 0.9, system: 0.68, security: 0.55 };
export const planetRadius = (scale: number) => Math.max(14, PLANET_R * scale);
export const sunRadius = (scale: number) => Math.max(20, SUN_R * scale);

/** Outer ring radius in world units; labels/planets are sized in screen px. */
export const OUTER_EXTENT = RING_RADIUS.security;
const HUD = 40, PADX = 70, PADY = 54; // top strip kept for the HUD; planet + label margins
const W3: V3 = { x: 0, y: 0, z: 0 }, PR: Proj = { x: 0, y: 0, d: 0, k: 1 };

/** Default view: the projected outer ring (with a margin for bodies and labels) centered in the canvas. */
export function fitView(w: number, h: number): View {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const cam = makeCam();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    planeToWorld("security", OUTER_EXTENT * Math.cos(a), OUTER_EXTENT * Math.sin(a), W3);
    project(cam, W3.x, W3.y, W3.z, PR);
    x0 = Math.min(x0, PR.x); x1 = Math.max(x1, PR.x); y0 = Math.min(y0, PR.y); y1 = Math.max(y1, PR.y);
  }
  const scale = Math.max(0.05, Math.min((w / 2 - PADX) / Math.max(-x0, x1), ((h - HUD) / 2 - PADY) / ((y1 - y0) / 2))) || 1;
  return { scale, tx: w / 2, ty: HUD + (h - HUD) / 2 - (scale * (y0 + y1)) / 2 };
}
