// MIRRORS mmoarena shared/src/botbrain.ts: Variant, Population, POP_SIZE, EVOLVE_GAMES, newPopulation, pickVariant
// (Thompson sampling), recordResult, evolve. All GENERIC; `classId` becomes a free `key`, brains are spec-driven.
// Differences: no per-class JSON baseline lookup (the caller passes `base`), no `Guide` pull (not needed yet).
import { clampBrain, mutateBrain, type Brain, type BrainSpec } from "./brain.ts";

export interface Variant { id: string; brain: Brain; wins: number; games: number }
export interface Population { key: string; variants: Variant[]; generation: number; sinceEvolve: number }

export const POP_SIZE = 6;
/** Games each variant needs (half of this) before the worst can be replaced. */
export const EVOLVE_GAMES = 6;

export function newPopulation(specs: readonly BrainSpec[], key: string, base: Brain, rng: () => number): Population {
  const variants: Variant[] = [{ id: "g0v0", brain: clampBrain(specs, base), wins: 0, games: 0 }];
  for (let i = 1; i < POP_SIZE; i++) variants.push({ id: `g0v${i}`, brain: mutateBrain(specs, base, rng, 0.2, 0.6), wins: 0, games: 0 });
  return { key, variants, generation: 0, sinceEvolve: 0 };
}

/** A population loaded from storage, every brain completed against `base` (older saves miss newer numbers). */
export function freshenPopulation(specs: readonly BrainSpec[], pop: Population, base: Brain): Population {
  for (const v of pop.variants) v.brain = clampBrain(specs, v.brain, base);
  return pop;
}

const gaussish = (rng: () => number) => (rng() + rng() + rng() - 1.5) / 0.5; // roughly N(0,1)
function betaSample(a: number, b: number, rng: () => number): number {
  const mean = a / (a + b);
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  return Math.min(1, Math.max(0, mean + gaussish(rng) * sd));
}

/** Thompson sampling: variants that win more get picked more, uncertain ones still get tried. */
export function pickVariant(pop: Population, rng: () => number): Variant {
  let best = pop.variants[0];
  let bestV = -1;
  for (const v of pop.variants) {
    const s = betaSample(v.wins + 1, Math.max(0, v.games - v.wins) + 1, rng);
    if (s > bestV) { bestV = s; best = v; }
  }
  return best;
}

export const rate = (v: Variant) => (v.wins + 1) / (v.games + 2);

/** Credit one finished run (`score` 0..1 lets partial success count). Returns true when the population evolved. */
export function recordResult(specs: readonly BrainSpec[], pop: Population, variantId: string, won: boolean, rng: () => number, score?: number): boolean {
  const v = pop.variants.find((x) => x.id === variantId);
  if (!v) return false; // the population moved on: that variant was already replaced
  v.games++;
  v.wins += score !== undefined ? Math.min(1, Math.max(0, score)) : won ? 1 : 0;
  pop.sinceEvolve++;
  if (pop.sinceEvolve >= EVOLVE_GAMES * POP_SIZE && pop.variants.every((x) => x.games >= EVOLVE_GAMES / 2)) {
    evolve(specs, pop, rng);
    return true;
  }
  return false;
}

/** Replace the weakest variant with a mutation of the best (or a blend of the top two) and halve everyone's record. */
export function evolve(specs: readonly BrainSpec[], pop: Population, rng: () => number): void {
  const ranked = [...pop.variants].sort((a, b) => rate(b) - rate(a));
  const [best, second] = ranked;
  const worst = ranked[ranked.length - 1];
  pop.generation++;
  const blend: Brain = { ...best.brain };
  if (second && rng() < 0.5) for (const s of specs) if (rng() < 0.5) blend[s.name] = second.brain[s.name];
  const child: Variant = { id: `g${pop.generation}v${Math.floor(rng() * 1e6)}`, brain: mutateBrain(specs, clampBrain(specs, blend), rng, 0.12, 0.5), wins: 0, games: 0 };
  pop.variants[pop.variants.indexOf(worst)] = child;
  for (const v of pop.variants) {
    v.wins = Math.round((v.wins / 2) * 100) / 100;
    v.games = Math.round(v.games / 2);
  }
  child.wins = 0;
  child.games = 0;
  pop.sinceEvolve = 0;
}

/** Sentinel-only: put a lesson brain into the population in place of the weakest variant (never the best). */
export function addVariant(pop: Population, brain: Brain, id: string): void {
  const ranked = [...pop.variants].sort((a, b) => rate(a) - rate(b));
  pop.variants[pop.variants.indexOf(ranked[0])] = { id, brain, wins: 0, games: 0 };
}

export const bestVariant = (pop: Population): Variant => [...pop.variants].sort((a, b) => rate(b) - rate(a))[0];
