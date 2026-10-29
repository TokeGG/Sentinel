// Learning kernel, shared design with the user's mmoarena bots.
// MIRRORS /mmoarena shared/src/botbrain.ts (Brain, BRAIN_BOUNDS, clampBrain, mutateBrain) and
// shared/src/outplay.ts (sanityClamp). GENERIC parts (identical maths, spec-driven here instead of a fixed
// interface): clampBrain, readBrain, mutateBrain, sanityClamp. Sentinel-only: BrainSpec, seededRng.
// A brain = a fixed set of bounded numbers; learning only ever moves those numbers.

export interface BrainSpec { name: string; min: number; max: number; default: number }
export type Brain = Record<string, number>;
/** Same shape as mmoarena shared/data/botbrain.json: top-level key per "class", values name -> number. */
export type BrainFile = Record<string, Brain>;

export const range = (s: BrainSpec) => s.max - s.min;
export const clampTo = (s: BrainSpec, v: number) => Math.min(s.max, Math.max(s.min, v));

export function defaultBrain(specs: readonly BrainSpec[]): Brain {
  return Object.fromEntries(specs.map((s) => [s.name, s.default]));
}

/** Every spec'd number in range; missing or non-numeric keys come from `base`, unknown keys are dropped. */
export function clampBrain(specs: readonly BrainSpec[], b: Record<string, unknown> | undefined | null, base?: Brain): Brain {
  const out: Brain = {};
  for (const s of specs) {
    const v = b?.[s.name];
    const fallback = base?.[s.name];
    out[s.name] = clampTo(s, typeof v === "number" && Number.isFinite(v) ? v : typeof fallback === "number" && Number.isFinite(fallback) ? fallback : s.default);
  }
  return out;
}

/** Tolerant read of untrusted JSON (an older save, a pasted file): anything that is not an object reads as the base. */
export function readBrain(specs: readonly BrainSpec[], raw: unknown, base?: Brain): Brain {
  return clampBrain(specs, raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined, base);
}

/** A nearby brain: each number moves by a random fraction of its range with probability `rate`. */
export function mutateBrain(specs: readonly BrainSpec[], b: Brain, rng: () => number, amount = 0.15, rate = 0.5): Brain {
  const out: Brain = { ...b };
  for (const s of specs) {
    if (rng() > rate) continue;
    out[s.name] = (out[s.name] ?? s.default) + (rng() * 2 - 1) * amount * range(s);
  }
  return clampBrain(specs, out);
}

/** Drift limit: no number ends up further than `frac` of its range (or its entry in `room`) from the shipped brain. */
export function sanityClamp(specs: readonly BrainSpec[], brain: Brain, shipped: Brain, frac = 0.6, room: Record<string, number> = {}): Brain {
  const out: Brain = { ...brain };
  for (const s of specs) {
    const lim = (room[s.name] ?? frac) * range(s);
    const base = shipped[s.name] ?? s.default;
    out[s.name] = clampTo(s, Math.min(base + lim, Math.max(base - lim, brain[s.name] ?? s.default)));
  }
  return out;
}

/** Deterministic RNG (mulberry32) so variant picking and mutation are reproducible in tests and replays. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
