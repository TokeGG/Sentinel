// The taste model (pure, local): per-module profile of decayed feature weights.
// Same ideas as bot/kernel/nudge.ts: evidence fades 8% when new evidence for the
// same feature arrives, and one update never moves a value more than STEP_CAP.
import { featureKind, featureLabel } from "./features.ts";

export type Signal = "like" | "dislike" | "open" | "dismiss" | "hide" | "finish";
export const SIGNAL_VALUE: Record<Signal, number> = { like: 1, dislike: -1, open: 0.3, dismiss: -0.7, hide: -1, finish: 0.5 };
export const SIGNALS = Object.keys(SIGNAL_VALUE) as Signal[];

export const FADE = 0.92; // old evidence keeps this much when new evidence arrives
export const STEP_CAP = 0.35; // one update moves a feature's value at most this far
export const MAX_N = 12; // evidence weight cap
export const CONFIDENCE = 3; // affinity = v * n / (n + CONFIDENCE)
export const MAX_FEATURES = 400;
export const EPSILON = 0.08; // chance an item with no known feature gets surfaced anyway
export const EXPLORE_BOOST = 0.4;

export interface Ev { v: number; n: number } // v: weighted mean signal in [-1,1]; n: evidence weight
export interface Profile { f: Record<string, Ev>; events: number }
export interface TasteItem { key: string; features: string[] }
export interface Why { feature: string; label: string; contrib: number }
export interface Ranked<T> { item: T; score: number; why: Why[]; explored: boolean }

export const emptyProfile = (): Profile => ({ f: {}, events: 0 });

const TYPE_WEIGHT: Record<string, number> = { src: 1, ch: 1, from: 1, repo: 0.8, tick: 0.8, store: 0.7, cat: 0.6, tag: 0.6, price: 0.4, kw: 0.35 };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const affinity = (e: Ev) => (e.v * e.n) / (e.n + CONFIDENCE);

export function applySignal(p: Profile, features: string[], signal: Signal): Profile {
  const s = SIGNAL_VALUE[signal];
  const w = Math.abs(s);
  const f: Record<string, Ev> = { ...p.f };
  for (const k of new Set(features)) {
    const o = f[k];
    const n0 = o ? o.n * FADE : 0;
    const mean = o ? (o.v * n0 + s * w) / (n0 + w) : s;
    const prev = o?.v ?? 0;
    f[k] = { v: clamp(mean, prev - STEP_CAP, prev + STEP_CAP), n: Math.min(MAX_N, n0 + w) };
  }
  const keys = Object.keys(f);
  if (keys.length > MAX_FEATURES) {
    keys.sort((a, b) => Math.abs(affinity(f[b])) - Math.abs(affinity(f[a])));
    for (const k of keys.slice(MAX_FEATURES)) delete f[k];
  }
  return { f, events: p.events + 1 };
}

export function forgetFeature(p: Profile, feature: string): Profile {
  const f = { ...p.f };
  delete f[feature];
  return { ...p, f };
}

/** Learned features sorted by strength: positive first (liked) or negative first (disliked). */
export function topFeatures(p: Profile, sign: 1 | -1, n = 8): { feature: string; label: string; strength: number }[] {
  return Object.entries(p.f)
    .map(([feature, e]) => ({ feature, label: featureLabel(feature), strength: affinity(e) * TYPE_WEIGHT_OF(feature) }))
    .filter((x) => x.strength * sign > 0.01)
    .sort((a, b) => (b.strength - a.strength) * sign)
    .slice(0, n);
}
const TYPE_WEIGHT_OF = (f: string) => TYPE_WEIGHT[featureKind(f)] ?? 0.3;

const contribs = (item: TasteItem, p: Profile): Why[] =>
  item.features
    .filter((f) => p.f[f])
    .map((f) => ({ feature: f, label: featureLabel(f), contrib: affinity(p.f[f]) * TYPE_WEIGHT_OF(f) }));

/** Squashed sum of the item's feature contributions, in (-1, 1). */
export function score(item: TasteItem, p: Profile): number {
  return Math.tanh(contribs(item, p).reduce((a, c) => a + c.contrib, 0));
}

/** Top 3 features behind an item's score (strongest first). */
export function why(item: TasteItem, p: Profile): Why[] {
  return contribs(item, p).filter((c) => Math.abs(c.contrib) > 0.005).sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib)).slice(0, 3);
}

/**
 * Items best-first (stable: ties keep input order). An item with no known feature
 * gets, with chance `epsilon`, a boost so unseen sources can still surface.
 * `rng` is injected; it is called once per unknown item, in input order.
 */
export function rank<T extends TasteItem>(items: T[], p: Profile, rng: () => number, epsilon = EPSILON): Ranked<T>[] {
  return items
    .map((item, i) => {
      const w = why(item, p);
      const unknown = p.events > 0 && !item.features.some((f) => p.f[f]);
      const explored = unknown && rng() < epsilon;
      return { r: { item, score: score(item, p) + (explored ? EXPLORE_BOOST : 0), why: w, explored }, i };
    })
    .sort((a, b) => b.r.score - a.r.score || a.i - b.i)
    .map((x) => x.r);
}
