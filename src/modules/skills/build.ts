// Skill builder (Tauri glue): the local model drafts a SKILL.md for a described task; the user edits it and saves
// it only after a preview. Saving reuses the install path (skills_write into the app skills dir + installed_skills
// row + invalidateSkills), with repo "local" and no SHA. Model: Ollama on 127.0.0.1 only.
import { invoke } from "@tauri-apps/api/core";
import { ollamaJson } from "../bot/llm";
import { ollamaFetch } from "../bot/ollamaFetch";
import { bundledSkills } from "./bundled";
import { invalidateSkills } from "./registry";
import { checkDraft, draftMessages, draftToMarkdown, LOCAL_REPO } from "./skillDraft";
import { getSetting, LOCAL_MODEL_KEY, saveSkill, skillRow, skillRows } from "./store";

type A = Record<string, unknown> | undefined;

export async function draftSkill(a: A) {
  const task = String(a?.task ?? "").trim();
  if (!task) throw new Error("Describe the task first.");
  const model = (await getSetting(LOCAL_MODEL_KEY)) ?? "";
  if (!model) throw new Error("Choose a local model first (Local model section).");
  const raw = await ollamaJson({ fetch: ollamaFetch, model, options: { temperature: 0.3 } }, draftMessages(task, String(a?.category ?? "")));
  return { text: draftToMarkdown(raw, task, String(a?.category ?? "") || undefined) };
}

/** Names already taken (bundled + installed, except the local skill being overwritten). */
async function takenNames(exceptId: string): Promise<string[]> {
  const rows = await skillRows();
  return [...bundledSkills.map((s) => s.name), ...rows.filter((r) => r.id !== exceptId).map((r) => r.name)];
}

/** Validates the text and writes it. `overwrite` must be true to replace an existing local skill of the same name. */
export async function saveLocalSkill(a: A) {
  const text = String(a?.text ?? "");
  const pre = checkDraft(text, []);
  if (!pre.ok) throw new Error(pre.error);
  const existing = await skillRow(pre.id);
  if (existing && existing.repo !== LOCAL_REPO) throw new Error("That id belongs to an installed skill; choose another name.");
  if (existing && a?.overwrite !== true) throw new Error(`A local skill "${pre.skill.name}" exists; tick Replace to overwrite it.`);
  const c = checkDraft(text, await takenNames(pre.id));
  if (!c.ok) throw new Error(c.error);
  await invoke("skills_write", { kind: "skill", id: c.id, files: [{ path: "SKILL.md", content: text }] });
  await saveSkill({ id: c.id, name: c.skill.name, description: c.skill.description, bundle: c.skill.module, repo: LOCAL_REPO, subdir: "", sha: "", files: JSON.stringify([{ path: "SKILL.md", size: text.length, sha: "" }]) }, existing ? existing.enabled : 1);
  await invalidateSkills();
  return { ok: true, id: c.id };
}
