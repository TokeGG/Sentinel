// MIRRORS the pattern of mmoarena shared/src/mistakes.ts + graded.ts: pure detectors over a recorded run
// (here an Episode) -> countable mistakes, each teaching ONE brain number via a lesson {value, weight} for
// kernel/nudge.ts; plus graded signals (steps to goal, retries) that teach even when nothing clearly went wrong.
import type { Episode, Step } from "./actions.ts";
import { actionKey, CLICKY, NO_CHANGE } from "./actions.ts";
import type { Lessons } from "./kernel/nudge.ts";

export type MistakeKind = "actionFailed" | "noPageChange" | "loop" | "wrongElement" | "notVisible" | "timeout" | "refused" | "thumbsDown";
export type MistakeCounts = Partial<Record<MistakeKind, number>>;

export const MISTAKE_LABELS: Record<MistakeKind, string> = {
  actionFailed: "actions that failed",
  noPageChange: "clicks that changed nothing",
  loop: "repeated identical actions (stuck loop)",
  wrongElement: "wrong or missing element / element type",
  notVisible: "element was off-screen",
  timeout: "actions that timed out",
  refused: "model answers that were not a valid action",
  thumbsDown: "user thumbs-down",
};

/** What each mistake teaches: the brain number, the value it points to, and the weight one occurrence carries. */
export const TEACHES: Record<MistakeKind, { key: string; value: number; weight: number }> = {
  actionFailed: { key: "waitAfterAction", value: 2500, weight: 8 },
  noPageChange: { key: "verifyStrictness", value: 0.9, weight: 8 },
  loop: { key: "loopPatience", value: 2, weight: 15 },
  wrongElement: { key: "elementTextWeight", value: 0.9, weight: 10 },
  notVisible: { key: "preferVisibleFirst", value: 1, weight: 10 },
  timeout: { key: "timeoutSec", value: 40, weight: 12 },
  refused: { key: "temperature", value: 0, weight: 6 },
  thumbsDown: { key: "confirmAt", value: 0.2, weight: 25 },
};

const WRONG_ELEMENT = /not found|no such|unknown element|not (a|an) (input|editable|clickable|button|link)|cannot (type|click)|wrong (element|type)|detached/i;
const OFFSCREEN = /not visible|off-?screen|out of view|outside (the )?viewport|obscured|covered/i;
export const LOOP_RUN = 3;

/** One kind per step at most (a failed step is classified once, most specific first). */
export function classifyStep(s: Step): MistakeKind | null {
  if (s.action === null) return "refused";
  if (s.ok) return CLICKY.has(s.action.type) && !s.changed ? "noPageChange" : null;
  if (s.timedOut) return "timeout";
  const e = s.error ?? "";
  if (e === NO_CHANGE) return "noPageChange";
  if (OFFSCREEN.test(e)) return "notVisible";
  if (WRONG_ELEMENT.test(e)) return "wrongElement";
  return "actionFailed";
}

/** Runs of >= LOOP_RUN identical actions on an unchanged page, each run counted once. */
export function countLoops(steps: Step[]): number {
  let runs = 0;
  let len = 0;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const p = steps[i - 1];
    len = s.action && p?.action && actionKey(s.action) === actionKey(p.action) && s.obs === p.obs ? len + 1 : 1;
    if (len === LOOP_RUN && s.action) runs++;
  }
  return runs;
}

export function detectMistakes(ep: Episode): MistakeCounts {
  const c: MistakeCounts = {};
  const add = (k: MistakeKind, n = 1) => { if (n > 0) c[k] = (c[k] ?? 0) + n; };
  for (const s of ep.steps) { const k = classifyStep(s); if (k) add(k); }
  add("loop", Math.max(countLoops(ep.steps), ep.outcome === "loop" ? 1 : 0));
  if (ep.thumbs === "down") add("thumbsDown");
  return c;
}

/** Graded signals: measured every run, so a run with no clear mistake still teaches. */
export interface Graded { steps: number; retries: number; reached: boolean; maxSteps: number }
export function gradedOf(ep: Episode): Graded {
  return { steps: ep.steps.length, retries: ep.steps.reduce((n, s) => n + (s.retries ?? 0), 0), reached: ep.outcome === "done", maxSteps: ep.maxSteps };
}

/** Graded -> lessons. Up-only (kernel directions are per number): reaching the goal close to the step cap raises the cap; heavy retrying means pages need longer to settle. */
export function gradedLessons(g: Graded): Lessons {
  const out: Lessons = {};
  if (g.reached && g.steps >= 0.8 * g.maxSteps) out.maxStepsPerGoal = { value: Math.min(60, Math.ceil(g.maxSteps * 1.3)), weight: 12 };
  if (g.steps >= 3 && g.retries / g.steps > 0.3) out.waitAfterAction = { value: 2000, weight: 6 + 2 * g.retries };
  return out;
}

/** 0..1 credit for the variant that played the run: finished and efficient scores high, thumbs-down caps it low. */
export function episodeScore(ep: Episode): number {
  if (ep.thumbs === "down") return 0.1;
  if (ep.outcome !== "done") return 0;
  const g = gradedOf(ep);
  return Math.min(1, Math.max(0.5, 1 - 0.4 * (g.steps / Math.max(1, g.maxSteps)) - 0.02 * g.retries)) * (ep.thumbs === "up" ? 1 : 0.95);
}

/** All lessons from one run. A run that did not finish counts double (as losing does in mmoarena). */
export function lessonsFromEpisode(ep: Episode): Lessons {
  const m = ep.outcome === "done" && ep.thumbs !== "down" ? 1 : 2;
  const out: Lessons = {};
  for (const [kind, n] of Object.entries(detectMistakes(ep)) as [MistakeKind, number][]) {
    const t = TEACHES[kind];
    const cur = out[t.key];
    out[t.key] = { value: t.value, weight: (cur?.weight ?? 0) + t.weight * n * m };
  }
  for (const [k, l] of Object.entries(gradedLessons(gradedOf(ep)))) {
    const cur = out[k];
    if (!cur || cur.weight < l.weight) out[k] = l;
  }
  return out;
}
