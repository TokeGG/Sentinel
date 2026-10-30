// Bot recipes: one saved workflow plus the site-notebook notes of the sites it visits, as a JSON file to share.
// Import is validated (shape, http(s) start address, known step types, caps) and previewed before anything is saved.
// Pure.
import { hostOf, MAX_SITE_NOTE, mergeSiteNote, type SiteNote } from "./siteNotes.ts";
import { parseSteps, type Workflow } from "./workflow.ts";

export const RECIPE_KIND = "sentinel-bot-recipe";
export interface Recipe { kind: typeof RECIPE_KIND; version: 1; workflow: Omit<Workflow, "id">; notes: SiteNote[] }
const MAX_STEPS = 200, MAX_NOTES = 20, MAX_BYTES = 512_000;

/** The hosts a workflow touches: its start address and every goto. */
export function workflowHosts(wf: Pick<Workflow, "startUrl" | "steps">): string[] {
  const hs = [wf.startUrl, ...wf.steps.flatMap((s) => (s.action.type === "goto" ? [s.action.url] : []))].map(hostOf).filter(Boolean);
  return [...new Set(hs)];
}

export function makeRecipe(wf: Workflow, notes: SiteNote[]): Recipe {
  const hosts = new Set(workflowHosts(wf));
  const { id: _id, ...rest } = wf;
  return { kind: RECIPE_KIND, version: 1, workflow: { ...rest, source: "run" }, notes: notes.filter((n) => hosts.has(n.host)).map((n) => ({ host: n.host, text: n.text })) };
}
export const recipeText = (r: Recipe) => JSON.stringify(r, null, 2);

export type RecipeParse = { ok: true; recipe: Recipe; warnings: string[] } | { ok: false; error: string };
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function parseRecipe(text: string): RecipeParse {
  if (text.length > MAX_BYTES) return { ok: false, error: "file is too large for a recipe" };
  let o: Record<string, unknown>;
  try { const j = JSON.parse(text); if (!j || typeof j !== "object" || Array.isArray(j)) return { ok: false, error: "not a JSON object" }; o = j; } catch { return { ok: false, error: "not valid JSON" }; }
  if (o.kind !== RECIPE_KIND) return { ok: false, error: `not a bot recipe (kind must be "${RECIPE_KIND}")` };
  if (o.version !== 1) return { ok: false, error: "unsupported recipe version" };
  const w = (o.workflow ?? {}) as Record<string, unknown>;
  const warnings: string[] = [];
  const rawSteps = Array.isArray(w.steps) ? w.steps : [];
  const steps = parseSteps(JSON.stringify(rawSteps.slice(0, MAX_STEPS)));
  if (rawSteps.length > steps.length) warnings.push(`${rawSteps.length - steps.length} unknown or extra steps were dropped`);
  const startUrl = str(w.startUrl, 2000);
  if (startUrl && !hostOf(startUrl)) return { ok: false, error: "the start address must be http(s)" };
  const bad = steps.find((s) => s.action.type === "goto" && !hostOf(s.action.url));
  if (bad) return { ok: false, error: "a goto step is not an http(s) address" };
  if (!steps.length) return { ok: false, error: "the recipe has no usable steps" };
  const rawNotes = Array.isArray(o.notes) ? o.notes : [];
  const notes = rawNotes.slice(0, MAX_NOTES).flatMap((n) => {
    const host = hostOf(`https://${str((n as SiteNote)?.host, 255)}`), t = str((n as SiteNote)?.text, MAX_SITE_NOTE).trim();
    return host && t ? [{ host, text: t }] : [];
  });
  if (rawNotes.length > notes.length) warnings.push(`${rawNotes.length - notes.length} notes were skipped`);
  const name = str(w.name, 80).trim() || "Imported recipe";
  return { ok: true, warnings, recipe: { kind: RECIPE_KIND, version: 1, workflow: { name, goal: str(w.goal, 500), startUrl, steps, source: "run" }, notes } };
}

/** What applying the recipe would change (shown before Apply). */
export function importPreview(r: Recipe, haveNames: string[], haveNotes: SiteNote[]): string[] {
  const by = new Map(haveNotes.map((n) => [n.host, n.text]));
  const lines = [`Add workflow "${r.workflow.name}" (${r.workflow.steps.length} steps${r.workflow.startUrl ? `, starts at ${hostOf(r.workflow.startUrl)}` : ""})${haveNames.includes(r.workflow.name) ? " - a workflow with this name exists; both are kept" : ""}`];
  for (const n of r.notes) {
    const old = by.get(n.host);
    const merged = mergeSiteNote(old ?? "", n.text.split("\n").map((l) => l.trim()).filter(Boolean));
    lines.push(old === undefined ? `New site note for ${n.host}` : merged === old ? `${n.host}: nothing new` : `Append to the ${n.host} note`);
  }
  const irr = r.workflow.steps.filter((s) => ["submit", "purchase", "delete", "login"].includes(s.action.type)).length;
  if (irr) lines.push(`${irr} irreversible step(s): replay still asks before each one`);
  return lines;
}
