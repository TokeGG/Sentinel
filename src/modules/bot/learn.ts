// One learning step, pure: an episode -> lessons merged into the running evidence -> a lesson brain (capped at 1/5 of
// range per number, 60% drift from the shipped brain) that replaces the weakest variant, and the run credits the
// variant that played it (which may evolve the population). Same flow as mmoarena server/src/botlearn.ts.
import { BROWSER_SPECS as S, LOWER_KEYS, shippedBrain } from "./brainSpecs.ts";
import type { Episode } from "./actions.ts";
import { sanityClamp } from "./kernel/brain.ts";
import { limitChange, lessonBrain, mergeLessons, type Lessons } from "./kernel/nudge.ts";
import { addVariant, bestVariant, recordResult, type Population } from "./kernel/variants.ts";
import { episodeScore, lessonsFromEpisode } from "./mistakes.ts";

export interface LearnState { pop: Population; lessons: Lessons }

/** Mutates `st.pop`, returns the new running lessons. `shipped` is the drift anchor. */
export function learnFromEpisode(st: LearnState, ep: Episode, rng: () => number, shipped = shippedBrain()): Lessons {
  const lessons = mergeLessons(st.lessons, lessonsFromEpisode(ep));
  const best = bestVariant(st.pop);
  const brain = sanityClamp(S, limitChange(S, best.brain, lessonBrain(S, best.brain, lessons, LOWER_KEYS)), shipped);
  const moved = S.some((s) => Math.abs(brain[s.name] - best.brain[s.name]) > 1e-9);
  if (ep.variantId) recordResult(S, st.pop, ep.variantId, ep.outcome === "done" && ep.thumbs !== "down", rng, episodeScore(ep));
  if (moved) addVariant(st.pop, brain, `l${st.pop.generation}v${Math.floor(rng() * 1e6)}`);
  return lessons;
}
