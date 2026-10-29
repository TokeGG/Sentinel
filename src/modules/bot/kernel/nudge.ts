// MIRRORS mmoarena shared/src/outplay.ts: LESSON_MIN_WEIGHT, LESSON_DECAY, lessonBrain, mergeLessons, limitChange.
// All four are GENERIC (spec-driven here). A lesson says "at least this" (or "at most this" for LOWER keys) with a
// weight; evidence adds up, older evidence fades 8% when new evidence for the same number arrives, and one
// nudge never moves a number more than 1/5 of its range.
import { clampTo, range, type Brain, type BrainSpec } from "./brain.ts";

export interface Lesson { value: number; weight: number }
export type Lessons = Record<string, Lesson>;

/** Evidence below this weight (after adding up) moves nothing yet. */
export const LESSON_MIN_WEIGHT = 20;
/** Old evidence keeps this much of its weight when new evidence for the same number arrives (an 8% fade). */
export const LESSON_DECAY = 0.92;
/** One nudge moves a number at most this fraction of its range. */
export const NUDGE_CAP = 0.2;

/**
 * `base` moved towards the lessons, only in the direction each one points (`lower` = keys where lower is the fix).
 * The step grows with the evidence (`pull` at weight `full`), never past the lesson's value or the bounds.
 */
export function lessonBrain(specs: readonly BrainSpec[], base: Brain, lessons: Lessons, lower: ReadonlySet<string> = new Set(), pull = 0.8, full = 150): Brain {
  const out: Brain = { ...base };
  for (const s of specs) {
    const m = lessons[s.name];
    const cur = base[s.name];
    if (!m || cur === undefined || m.weight < LESSON_MIN_WEIGHT || !Number.isFinite(m.value)) continue;
    if (lower.has(s.name) ? !(m.value < cur) : !(m.value > cur)) continue;
    out[s.name] = clampTo(s, cur + (m.value - cur) * pull * Math.min(1, m.weight / full));
  }
  return out;
}

/** Running lessons: older evidence faded first (only for numbers that get new evidence), new added as a weighted average. */
export function mergeLessons(old: Lessons, add: Lessons, decay = LESSON_DECAY, cap = 1200): Lessons {
  const out: Lessons = {};
  for (const [k, o] of Object.entries(old)) out[k] = { value: o.value, weight: o.weight * (k in add ? decay : 1) };
  for (const [k, n] of Object.entries(add)) {
    const o = out[k];
    const w = (o?.weight ?? 0) + n.weight;
    if (w <= 0) continue;
    out[k] = { value: o ? (o.value * o.weight + n.value * n.weight) / w : n.value, weight: Math.min(cap, w) };
  }
  return out;
}

/** `next` kept within `frac` of each number's range from `prev`: one episode never swings a brain far. */
export function limitChange(specs: readonly BrainSpec[], prev: Brain, next: Brain, frac = NUDGE_CAP): Brain {
  const out: Brain = { ...next };
  for (const s of specs) {
    const lim = frac * range(s);
    const p = prev[s.name] ?? s.default;
    out[s.name] = clampTo(s, Math.min(p + lim, Math.max(p - lim, next[s.name] ?? p)));
  }
  return out;
}
