// Picks the skills that fit what a bot is trying to do (pure). Scores each enabled skill by word overlap with the
// goal (name > description > body, light stemming), boosted when its `category:` matches a category the goal
// implies (or the caller's own category). Used by the browser bot, the Lab bot and every panel's Ask bar.
import { CATEGORIES, type Category } from "./categories.ts";

export interface PickableSkill { name: string; description: string; body: string; categories?: readonly string[] }
export interface PickOptions { max?: number; clip?: number; /** categories that always count as a match (e.g. the panel's own) */ categories?: readonly Category[]; /** only skills in these categories */ only?: readonly Category[]; /** thumbs per skill (app_settings `skill_scores`) */ scores?: SkillScores; /** how far a score moves a skill (default DEFAULT_BOOST_WEIGHT) */ weight?: number }

const STOP = new Set("the and for with that this from into your you are was what how can get all any out about have has its not but use".split(" "));
const stem = (w: string) => w.replace(/(ings?|ed|es|s)$/, "").slice(0, 7);
export const goalWords = (s: string): Set<string> =>
  new Set((s.toLowerCase().replace(/-/g, " ").match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w)).map(stem));

const HINTS: Record<Category, string> = {
  news: "news headline article story trend world politic report source fact",
  deals: "deal price coupon promo discount sale cheap buy wishlist store shop bargain",
  finance: "stock portfolio market budget money bill crypto invest expense spend bank tax",
  mail: "email mail inbox reply message unsubscribe spam scam sender",
  media: "video youtube watch movie show episode game music stream playlist anime",
  social: "social post reddit mastodon bluesky twitter thread chat follow mute",
  dev: "code repo github bug commit pull test build changelog error script api",
  system: "disk startup process network device wifi cpu driver update backup file cleanup",
  lab: "scan port pentest scope engagement cve vuln finding host recon ctf",
  productivity: "note task todo calendar meeting plan schedule summary review habit goal travel recipe",
};
const HINT_WORDS = Object.fromEntries(CATEGORIES.map((c) => [c, goalWords(HINTS[c])])) as Record<Category, Set<string>>;

/** Categories a goal implies, strongest first (ties keep CATEGORIES order). */
export function inferCategories(goal: string): Category[] {
  const g = goalWords(goal);
  return CATEGORIES.map((c) => ({ c, n: [...HINT_WORDS[c]].filter((w) => g.has(w)).length }))
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.c);
}

export interface Scored<T> { skill: T; score: number }

export function scoreSkills<T extends PickableSkill>(goal: string, skills: readonly T[], o: PickOptions = {}): Scored<T>[] {
  const g = goalWords(goal);
  const cats = new Set<string>([...(o.categories ?? []), ...inferCategories(goal)]);
  const hit = (s: string) => [...goalWords(s)].filter((w) => g.has(w)).length;
  return skills
    .filter((s) => !o.only || (s.categories ?? []).some((c) => (o.only as readonly string[]).includes(c)))
    .map((skill) => {
      const words = hit(skill.name) * 3 + hit(skill.description) * 2 + Math.min(3, hit(skill.body.slice(0, 1500)) * 0.5);
      const cat = (skill.categories ?? []).some((c) => cats.has(c)) ? 1.5 : 0;
      return { skill, score: words > 0 ? words + cat + (o.weight ?? DEFAULT_BOOST_WEIGHT) * scoreBoost(o.scores?.[skill.name]) : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));
}

/** Best-fitting skills (at most `max`, bodies clipped to `clip`); [] when nothing fits. */
export function pickSkillsFor<T extends PickableSkill>(goal: string, skills: readonly T[], o: PickOptions = {}): T[] {
  return scoreSkills(goal, skills, o).slice(0, o.max ?? 3).map((x) => ({ ...x.skill, body: x.skill.body.slice(0, o.clip ?? 1500) }));
}

// Thumbs per skill on bot runs (app_settings `skill_scores`, JSON {name: {up, down}}): a small boost/penalty on the
// score above. Only skills that already fit the goal get it (score 0 stays 0), so a thumb never adds an unrelated skill.
export interface SkillScore { up: number; down: number }
export type SkillScores = Record<string, SkillScore>;
export const SKILL_SCORES_KEY = "skill_scores";
export const BOOST_WEIGHT_KEY = "skill_boost_weight";
/** Most a score moves a skill (one name-word hit = 3). Settable in the bot panel. */
export const DEFAULT_BOOST_WEIGHT = 2;

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
/** In (-1, 1): (up - down) / (up + down + 2), so a single thumb only nudges. */
export const scoreBoost = (s: SkillScore | undefined) => (s ? (s.up - s.down) / (s.up + s.down + 2) : 0);
export const parseWeight = (v: string | null) => { const n = Number(v); return v !== null && v !== "" && Number.isFinite(n) ? Math.min(6, Math.max(0, n)) : DEFAULT_BOOST_WEIGHT; };
