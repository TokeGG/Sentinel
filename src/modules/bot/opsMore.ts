// Panel write operations for settings, site rules, skill thumbs, prompt library, routines, recipes and the memory
// viewer (manifest skills; Tauri-coupled). All settings are app_settings JSON keys; no new tables.
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getDb } from "../../core/db";
import { getSetting, setSetting } from "../skills/store";
import { resetState } from "./brainOps";
import { parseBotSettings } from "./botSettings";
import { seededRng } from "./kernel/brain";
import { parsePrompts, parseRoutines, PROMPTS_KEY, ROUTINES_KEY } from "./library";
import { dropLesson, editNote } from "./memory";
import { makeRecipe, parseRecipe, recipeText } from "./recipe";
import { rateSkillRun, resetSkillScores, saveBoostWeight, saveBotSettings, saveSiteRules } from "./runConfig";
import { mergeSiteNote } from "./siteNotes";
import { parseSiteRules } from "./siteRules";
import type { Q } from "./sql";
import * as m from "./sqlMemory";
import * as store from "./store";
import * as sx from "./storeExtras";

type A = Record<string, unknown> | undefined;
const ok = { ok: true };
const exec = async (q: Q) => (await getDb()).execute(q.sql, q.params);
const json = (v: unknown) => JSON.stringify(v ?? null);

export async function saveSettings(a: A) { await saveBotSettings(parseBotSettings(json(a?.settings))); return ok; }
export async function saveRules(a: A) { await saveSiteRules(parseSiteRules(json(a?.rules))); return ok; }
export async function rateSkill(a: A) {
  const name = String(a?.name ?? "");
  if (!name || name.length > 64) throw new Error("unknown skill");
  await rateSkillRun(name, a?.thumbs === "down" ? "down" : "up");
  return ok;
}
export async function resetScores() { await resetSkillScores(); return ok; }
export async function setBoostWeight(a: A) { await saveBoostWeight(Math.min(6, Math.max(0, Number(a?.weight) || 0))); return ok; }
export async function savePrompts(a: A) { await setSetting(PROMPTS_KEY, JSON.stringify(parsePrompts(json(a?.list)))); return ok; }
export async function saveRoutines(a: A) { await setSetting(ROUTINES_KEY, JSON.stringify(parseRoutines(json(a?.list)))); return ok; }
export const loadPrompts = async () => parsePrompts(await getSetting(PROMPTS_KEY));
export const loadRoutines = async () => parseRoutines(await getSetting(ROUTINES_KEY));

/** Returns the recipe text, and saves it to a file the user picks (cancel = text only). */
export async function exportRecipe(a: A) {
  const wf = await sx.getWorkflow(Number(a?.id));
  if (!wf) throw new Error("That workflow is gone.");
  const text = recipeText(makeRecipe(wf, await sx.siteNotes()));
  const path = await save({ defaultPath: `${wf.name.replace(/[^\w-]+/g, "_").slice(0, 40) || "recipe"}.bot.json`, filters: [{ name: "JSON", extensions: ["json"] }] });
  if (path) await invoke("write_text_file", { path, contents: text });
  return { ok: true, text, saved: path ?? null };
}
/** Applies a recipe the user already previewed (re-validated here). */
export async function importRecipe(a: A) {
  const r = parseRecipe(String(a?.text ?? ""));
  if (!r.ok) throw new Error(r.error);
  await sx.saveWorkflow(r.recipe.workflow);
  const have = new Map((await sx.siteNotes()).map((n) => [n.host, n.text]));
  for (const n of r.recipe.notes) await sx.putSiteNote(n.host, mergeSiteNote(have.get(n.host) ?? "", n.text.split("\n").map((l) => l.trim()).filter(Boolean)));
  return ok;
}

export async function updateNote(a: A) {
  const e = editNote(String(a?.title ?? ""), String(a?.text ?? ""));
  if (!e.ok) throw new Error(e.error);
  await exec(m.updateNote(Number(a?.id), e.title, e.text));
  return ok;
}
export async function deleteLesson(a: A) {
  const st = await store.loadLearnState();
  await store.saveLearnState({ ...st, lessons: dropLesson(st.lessons, String(a?.key ?? "")) });
  return ok;
}
/** Notes, site notes, lessons and the browser brain. Workflows, jobs, routines, settings stay. */
export async function clearMemory() {
  await exec(m.clearNotes());
  await exec(m.clearSiteNotes());
  await store.saveLearnState(resetState(seededRng(Date.now())));
  return ok;
}
