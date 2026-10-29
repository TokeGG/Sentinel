// In-memory skill registry other modules (and the future bot) read. Enabling,
// installing or removing a skill calls invalidateSkills(), so the next
// listSkills()/getSkill() sees it at once; other webviews learn via the
// `skills-changed` event. Bundled skills win a name clash with installed ones.
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { bundledSkills } from "./bundled";
import { parseSkillMd } from "./skillMd";
import { bundledOff, skillRows } from "./store";

export interface SkillInfo { name: string; description: string; bundle: string; source: "bundled" | "github"; enabled: boolean; body: string }

let cache: Promise<SkillInfo[]> | null = null;
let listening = false;

async function loadAll(): Promise<SkillInfo[]> {
  const off = new Set(await bundledOff());
  const out: SkillInfo[] = bundledSkills.map((s) => ({ name: s.name, description: s.description, bundle: s.module, source: "bundled", enabled: !off.has(s.name), body: s.body }));
  for (const r of await skillRows()) {
    const text = await invoke<string>("skills_read_file", { kind: "skill", id: r.id, path: "SKILL.md" }).catch(() => "");
    const doc = parseSkillMd(text);
    if (doc.ok && !out.some((s) => s.name === doc.skill.name))
      out.push({ name: doc.skill.name, description: doc.skill.description, bundle: r.bundle || doc.skill.module, source: "github", enabled: !!r.enabled, body: doc.skill.body });
  }
  return out;
}

function all(): Promise<SkillInfo[]> {
  if (!listening) {
    listening = true;
    listen("skills-changed", () => void (cache = null)).catch(() => void (listening = false));
  }
  return (cache ??= loadAll().catch((e) => ((cache = null), Promise.reject(e))));
}

/** Enabled skills only. */
export async function listSkills(): Promise<SkillInfo[]> {
  return (await all()).filter((s) => s.enabled);
}
export async function getSkill(name: string): Promise<SkillInfo | undefined> {
  return (await listSkills()).find((s) => s.name === name);
}
export async function invalidateSkills(): Promise<void> {
  cache = null;
  await emit("skills-changed").catch(() => undefined);
}
