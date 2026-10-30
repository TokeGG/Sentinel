// Skill builder, pure part: the prompt asking the local model to draft a SKILL.md for a described task, turning the
// model's JSON into SKILL.md text, and checking the (user-edited) text before it is saved as a local skill.
import type { ChatMessage } from "../bot/llm.ts";
import { CATEGORIES, isCategory } from "../../core/categories.ts";
import { parseSkillMd, type SkillDoc } from "./skillMd.ts";

export const DRAFT_RULES = `You write SKILL.md files: short how-to guides a small local assistant follows. Reply with ONE JSON object:
{"name":"lowercase-words-with-dashes","description":"one sentence: what it does and when to use it","category":"one of: ${CATEGORIES.join(", ")}","steps":["numbered how-to steps, plain and concrete"],"notes":["optional cautions"]}
Never include secrets, passwords or instructions to bypass confirmations. The user reviews everything before saving.`;

export function draftMessages(task: string, category?: string): ChatMessage[] {
  const hint = category && isCategory(category) ? `\nPreferred category: ${category}` : "";
  return [{ role: "system", content: DRAFT_RULES }, { role: "user", content: `TASK (from the user):\n${task.trim().slice(0, 2000)}${hint}` }];
}

export const slugName = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 64).replace(/[-_]+$/, "");
const oneLine = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => oneLine(x, 400)).filter(Boolean).slice(0, max) : []);

/** Model JSON (or anything) -> SKILL.md text the user can edit. Missing fields get safe placeholders. */
export function draftToMarkdown(raw: string, task: string, fallbackCategory = "productivity"): string {
  let o: Record<string, unknown> = {};
  try { const j = JSON.parse(raw); if (j && typeof j === "object" && !Array.isArray(j)) o = j; } catch { /* placeholders */ }
  const name = slugName(oneLine(o.name, 64)) || slugName(task.split(/\s+/).slice(0, 4).join(" ")) || "my-skill";
  const description = (oneLine(o.description, 300) || oneLine(task, 200) || "Describe what this skill does.").replace(/^["']|["']$/g, "");
  const category = isCategory(o.category) ? o.category : isCategory(fallbackCategory) ? fallbackCategory : "productivity";
  const steps = list(o.steps, 12);
  const notes = list(o.notes, 6);
  const title = name.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());
  const body = [`# ${title}`, "", ...(steps.length ? steps : ["Write the steps here."]).map((s, i) => `${i + 1}. ${s.replace(/^\d+[.)]\s*/, "")}`)];
  if (notes.length) body.push("", "## Notes", ...notes.map((n) => `- ${n}`));
  return `---\nname: ${name}\ndescription: ${description}\ncategory: ${category}\n---\n\n${body.join("\n")}\n`;
}

const SECRETISH = /\b(password|passwd|api[_-]?key|secret|token)\s*[:=]\s*\S{6,}/i;
export type DraftCheck = { ok: true; skill: SkillDoc; id: string; warnings: string[] } | { ok: false; error: string };

/** Validates the text to save. `taken` = names of existing skills (a clash would be hidden by the registry). */
export function checkDraft(text: string, taken: string[]): DraftCheck {
  if (text.length > 64_000) return { ok: false, error: "SKILL.md is too long (max 64 KB)" };
  const p = parseSkillMd(text);
  if (!p.ok) return p;
  if (SECRETISH.test(text)) return { ok: false, error: "it looks like it contains a password or key; remove it first" };
  if (!p.skill.body.trim()) return { ok: false, error: "the skill needs a body (the how-to steps)" };
  const warnings: string[] = [];
  if (!p.skill.meta.category) warnings.push("no category: the Ask bar will not pick it");
  else if (!p.skill.meta.category.split(/[,\s]+/).every((c) => !c || isCategory(c))) warnings.push(`unknown category: ${p.skill.meta.category}`);
  if (taken.includes(p.skill.name)) return { ok: false, error: `a skill named "${p.skill.name}" already exists; choose another name` };
  return { ok: true, skill: p.skill, id: localSkillId(p.skill.name), warnings };
}

/** Directory id for a locally built skill (mirrors Rust valid_id: lowercase, digits, - _ ., max 64). */
export const localSkillId = (name: string) => `local-${slugName(name)}`.slice(0, 64).replace(/[-_.]+$/, "");
export const LOCAL_REPO = "local";
