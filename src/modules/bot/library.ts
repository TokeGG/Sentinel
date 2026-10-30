// Prompt library (app_settings `bot_prompts`) and routines (app_settings `bot_routines`): saved goals with an Insert
// button, and ordered lists of saved workflows / goals run one after another on a button press. Pure.
export interface SavedPrompt { id: string; name: string; text: string }
export type RoutineItem = { kind: "workflow"; id: number } | { kind: "goal"; goal: string };
export interface Routine { id: string; name: string; items: RoutineItem[]; /** Keep going after a step that did not finish. */ continueOnFail: boolean }
export const PROMPTS_KEY = "bot_prompts";
export const ROUTINES_KEY = "bot_routines";
const MAX_LIST = 100, MAX_ITEMS = 20;

const arr = (json: string | null): unknown[] => { try { const v = JSON.parse(json ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
export const newId = (now: number, rnd: number) => `${now.toString(36)}${Math.floor(rnd * 1e6).toString(36)}`;

export function parsePrompts(json: string | null): SavedPrompt[] {
  return arr(json).slice(0, MAX_LIST).flatMap((p) => {
    const o = p as SavedPrompt, text = s(o?.text, 2000).trim();
    return s(o?.id, 40) && text ? [{ id: o.id, name: s(o.name, 80).trim() || text.slice(0, 40), text }] : [];
  });
}
export function addPrompt(list: SavedPrompt[], id: string, name: string, text: string): SavedPrompt[] {
  const t = text.trim().slice(0, 2000);
  if (!t) return list;
  return [...list, { id, name: name.trim().slice(0, 80) || t.slice(0, 40), text: t }].slice(-MAX_LIST);
}
export const removeById = <T extends { id: string }>(list: T[], id: string): T[] => list.filter((x) => x.id !== id);

function item(v: unknown): RoutineItem | null {
  const o = v as Record<string, unknown>;
  if (o?.kind === "workflow" && Number.isInteger(o.id) && (o.id as number) > 0) return { kind: "workflow", id: o.id as number };
  if (o?.kind === "goal" && s(o.goal, 500).trim()) return { kind: "goal", goal: s(o.goal, 500).trim() };
  return null;
}
export function parseRoutines(json: string | null): Routine[] {
  return arr(json).slice(0, MAX_LIST).flatMap((r) => {
    const o = r as Routine;
    const items = (Array.isArray(o?.items) ? o.items : []).map(item).filter((x): x is RoutineItem => !!x).slice(0, MAX_ITEMS);
    return s(o?.id, 40) && items.length ? [{ id: o.id, name: s(o.name, 80).trim() || "Routine", items, continueOnFail: o.continueOnFail === true }] : [];
  });
}
export function upsertRoutine(list: Routine[], r: Routine): Routine[] {
  const clean = parseRoutines(JSON.stringify([r]))[0];
  if (!clean) return list;
  return list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? clean : x)) : [...list, clean].slice(-MAX_LIST);
}

/** Label of one routine item ("workflow: Check mail" / "goal: find ..."). */
export function itemLabel(it: RoutineItem, wfName: (id: number) => string | undefined): string {
  return it.kind === "workflow" ? `workflow: ${wfName(it.id) ?? `#${it.id} (deleted)`}` : `goal: ${it.goal.slice(0, 80)}`;
}

/** Whether the chain goes on after an item ended with `outcome`. Stop/decline always end the chain. */
export function continueAfter(outcome: string | null, continueOnFail: boolean): boolean {
  if (outcome === null || outcome === "cancelled" || outcome === "denied") return false;
  return outcome === "done" || continueOnFail;
}
