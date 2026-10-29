// The BROWSER bot's brain: bounded numbers that decide how it chooses and paces, never what it is able to do
// (the action set in actions.ts is code). Learning (mistakes.ts -> kernel/) only moves these. Integer-valued
// numbers (retryLimit, maxStepsPerGoal, loopPatience, observeBudget, lessonCount) are rounded where used (see `int`).
import { defaultBrain, readBrain, type Brain, type BrainFile, type BrainSpec } from "./kernel/brain.ts";

export const BROWSER_CLASS = "browser";
/** Lab mode keeps its own brain (same specs) so scope-gated runs do not tune the normal bot; share via brainOps. */
export const LAB_CLASS = "lab";
// Shipped defaults were tuned for a local 7-8B model (Ollama) on ordinary sites: see the comment on each number.

export const BROWSER_SPECS: readonly BrainSpec[] = [
  { name: "waitAfterAction", min: 200, max: 5000, default: 1100 }, // ms to let the page settle; 1.1 s covers most JS re-renders
  { name: "retryLimit", min: 0, max: 5, default: 1 }, // re-tries of a failed action; one is enough, then the model should try another way
  { name: "scrollStep", min: 0.2, max: 1, default: 0.7 }, // fraction of a viewport per scroll
  { name: "maxStepsPerGoal", min: 5, max: 60, default: 30 }, // search + banner + pagination tasks need ~10-20 steps; 30 leaves room
  { name: "confirmAt", min: 0, max: 1, default: 0.5 }, // risk at/above which the user is asked first (lower = asks more)
  { name: "verifyStrictness", min: 0, max: 1, default: 0.5 }, // >= .5: an action with no page change is treated as failed
  { name: "loopPatience", min: 2, max: 6, default: 3 }, // identical repeated actions tolerated before giving up
  { name: "elementTextWeight", min: 0, max: 1, default: 0.6 }, // text match vs position when ranking elements (driver)
  { name: "preferVisibleFirst", min: 0, max: 1, default: 0.8 }, // rank on-screen elements first (driver)
  { name: "timeoutSec", min: 5, max: 60, default: 20 }, // per action; slow pages on home connections
  { name: "wallClockSec", min: 30, max: 600, default: 360 }, // per goal; a local 7-8B model takes ~5-10 s per step
  { name: "observeBudget", min: 10, max: 80, default: 50 }, // elements shown to the model; fits an 8k context with notes + plan
  { name: "lessonCount", min: 0, max: 8, default: 4 }, // notes retrieved into the prompt
  { name: "temperature", min: 0, max: 1, default: 0.1 }, // low: small models produce valid JSON more reliably
];

/** Numbers where a lesson's fix is LOWER (give up sooner, ask the user more, sample less randomly). */
export const LOWER_KEYS: ReadonlySet<string> = new Set(["loopPatience", "confirmAt", "temperature"]);

export const DEFAULT_BROWSER_BRAIN: Brain = defaultBrain(BROWSER_SPECS);

/** The shipped brain, in the same shape as mmoarena's botbrain.json (until training, the defaults). */
export const SHIPPED_BRAINS: BrainFile = { [BROWSER_CLASS]: { ...DEFAULT_BROWSER_BRAIN } };
export const shippedBrain = (): Brain => readBrain(BROWSER_SPECS, SHIPPED_BRAINS[BROWSER_CLASS]);

export const int = (b: Brain, k: string) => Math.round(b[k] ?? 0);
