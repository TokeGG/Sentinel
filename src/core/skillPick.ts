// Pure skill choice for the browser bot (and anything else that ranks skills against a goal): word overlap between
// the goal and the skill's name/description, plus a small boost/penalty from the user's thumbs on runs that used the
// skill (app_settings `skill_scores`, JSON {name: {up, down}}). The boost never makes an unrelated skill relevant.
export interface SkillScore { up: number; down: number }
export type SkillScores = Record<string, SkillScore>;
export const SKILL_SCORES_KEY = "skill_scores";
/** Most a score can move a skill, in overlap words. Settable in the bot panel (`skill_boost_weight`). */
export const DEFAULT_BOOST_WEIGHT = 0.75;
export const BOOST_WEIGHT_KEY = "skill_boost_weight";

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(10_000, Math.floor(v)) : 0);

export function parseScores(json: string | null): SkillScores {
  try {
    const o = JSON.parse(json ?? "{}");
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const out: SkillScores = {};
    for (const [k, v] of Object.entries(o as Record<string, { up?: unknown; down?: unknown }>)) if (k.length <= 64 && v && typeof v === "object") out[k] = { up: count(v.up), down: count(v.down) };
    return out;
  } catch { return {}; }
}

export function rateSkill(scores: SkillScores, name: string, thumbs: "up" | "down"): SkillScores {
  const s = scores[name] ?? { up: 0, down: 0 };
  return { ...scores, [name]: thumbs === "up" ? { ...s, up: s.up + 1 } : { ...s, down: s.down + 1 } };
}

/** In [-1, 1]: (up - down) / (up + down + 2), so a single thumb only nudges. */
export function scoreBoost(s: SkillScore | undefined): number {
  if (!s) return 0;
  return (s.up - s.down) / (s.up + s.down + 2);
}

export interface PickSkill { name: string; description: string; body: string }
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);

/** The skills whose name/description overlap the goal, best first (overlap + weight * boost), bodies clipped. */
export function pickSkills<T extends PickSkill>(goal: string, skills: T[], scores: SkillScores = {}, max = 3, clip = 1500, weight = DEFAULT_BOOST_WEIGHT): T[] {
  const g = words(goal);
  return skills
    .map((s) => ({ s, n: [...words(`${s.name.replace(/[-_]/g, " ")} ${s.description}`)].filter((w) => g.has(w)).length }))
    .filter((x) => x.n > 0)
    .map((x) => ({ ...x, r: x.n + weight * scoreBoost(scores[x.s.name]) }))
    .sort((a, b) => b.r - a.r || a.s.name.localeCompare(b.s.name))
    .slice(0, max)
    .map((x) => ({ ...x.s, body: x.s.body.slice(0, clip) }));
}

export const parseWeight = (v: string | null) => { const n = Number(v); return v !== null && v !== "" && Number.isFinite(n) ? Math.min(3, Math.max(0, n)) : DEFAULT_BOOST_WEIGHT; };
