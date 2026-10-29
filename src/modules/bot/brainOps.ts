// Whole-brain operations the panel offers: export/import in the botbrain.json convention, reset to shipped, and the
// views (active variant vs shipped numbers, win-rate per variant). Pure.
import type { Episode } from "./actions.ts";
import { BROWSER_CLASS, BROWSER_SPECS, LAB_CLASS, shippedBrain } from "./brainSpecs.ts";
import type { Brain } from "./kernel/brain.ts";
import { exportBrains, importBrains } from "./kernel/brainFile.ts";
import { bestVariant, newPopulation, rate, type Population } from "./kernel/variants.ts";
import type { LearnState } from "./learn.ts";

/** botbrain.json text: the normal brain, plus the Lab brain when given (both classes in one file). */
export const exportText = (st: LearnState, lab?: LearnState | null): string =>
  exportBrains(BROWSER_SPECS, { [BROWSER_CLASS]: bestVariant(st.pop).brain, ...(lab ? { [LAB_CLASS]: bestVariant(lab.pop).brain } : {}) });

/** A fresh state around `base` (variant 0 is `base` itself, the rest are mutations); the running lessons start over. */
export const freshState = (base: Brain, rng: () => number, cls = BROWSER_CLASS): LearnState => ({ pop: newPopulation(BROWSER_SPECS, cls, base, rng), lessons: {} });
/** Brain share between Lab and normal mode: the target starts fresh around the source's best brain. */
export const shareState = (from: LearnState, rng: () => number, toCls: string): LearnState => freshState(bestVariant(from.pop).brain, rng, toCls);
export const resetState = (rng: () => number): LearnState => freshState(shippedBrain(), rng);

export type ImportOutcome = { ok: true; state: LearnState } | { ok: false; error: string };
export function importState(text: string, rng: () => number, cls = BROWSER_CLASS): ImportOutcome {
  const r = importBrains(BROWSER_SPECS, text, [cls]);
  if (!r.ok) return r;
  const b = r.brains[cls];
  return b ? { ok: true, state: freshState(b, rng, cls) } : { ok: false, error: `no "${cls}" entry in that file` };
}

export interface BrainRow { name: string; active: string; shipped: string; moved: boolean }
const f = (n: number) => String(Math.round(n * 1000) / 1000);
export function brainRows(active: Brain, shipped: Brain = shippedBrain()): BrainRow[] {
  return BROWSER_SPECS.map((s) => ({ name: s.name, active: f(active[s.name]), shipped: f(shipped[s.name]), moved: Math.abs(active[s.name] - shipped[s.name]) > 1e-6 }));
}
export interface VariantRow { id: string; best: boolean; wins: number; games: number; winRate: string }
export function variantRows(pop: Population): VariantRow[] {
  const best = bestVariant(pop).id;
  return pop.variants.map((v) => ({ id: v.id, best: v.id === best, wins: Math.round(v.wins * 100) / 100, games: v.games, winRate: v.games ? `${Math.round((v.wins / v.games) * 100)}%` : `${Math.round(rate(v) * 100)}% (prior)` }));
}

/** A thumbs-down after the fact teaches through `thumbsDown` only: no steps (already learned from), no variant credit. */
export const thumbsDownEpisode = (ep: Episode): Episode => ({ ...ep, steps: [], thumbs: "down", variantId: undefined });
