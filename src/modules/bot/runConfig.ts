// Reads the per-run settings from app_settings (Tauri glue; the decisions are in the pure files it imports):
// model preset + Ollama options + step delay (botSettings.ts), per-site rules (siteRules.ts) and skill thumbs scores
// (core/skillPick.ts). Also the small writers the panel uses for those JSON keys.
import { getSetting, setSetting } from "../skills/store";
import { BOOST_WEIGHT_KEY, parseScores, parseWeight, rateSkill, SKILL_SCORES_KEY, type SkillScores } from "../../core/skillPick";
import { BOT_SETTINGS_KEY, parseBotSettings, type BotSettings } from "./botSettings";
import { parseSiteRules, SITE_RULES_KEY, type SiteRules } from "./siteRules";

export interface RunConfig { settings: BotSettings; rules: SiteRules; scores: SkillScores; weight: number }

export async function loadRunConfig(): Promise<RunConfig> {
  const [s, r, sc, w] = await Promise.all([BOT_SETTINGS_KEY, SITE_RULES_KEY, SKILL_SCORES_KEY, BOOST_WEIGHT_KEY].map((k) => getSetting(k).catch(() => null)));
  return { settings: parseBotSettings(s), rules: parseSiteRules(r), scores: parseScores(sc), weight: parseWeight(w) };
}

export const saveBotSettings = (s: BotSettings) => setSetting(BOT_SETTINGS_KEY, JSON.stringify(s));
export const saveSiteRules = (r: SiteRules) => setSetting(SITE_RULES_KEY, JSON.stringify(r));
export const saveBoostWeight = (w: number) => setSetting(BOOST_WEIGHT_KEY, String(w));

/** Thumbs on one skill a run used. */
export async function rateSkillRun(name: string, thumbs: "up" | "down") {
  const scores = parseScores(await getSetting(SKILL_SCORES_KEY));
  await setSetting(SKILL_SCORES_KEY, JSON.stringify(rateSkill(scores, name, thumbs)));
}
export const resetSkillScores = () => setSetting(SKILL_SCORES_KEY, "{}");
