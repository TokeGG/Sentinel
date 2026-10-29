// Saved workflows: a successful run's (or a demo's) page actions as an editable step list, replayed as a scripted
// "model" so every replay goes through the same agent loop, gates and confirm rules as a live run. Pure.
import type { Action, Episode, PageElement } from "./actions.ts";
import type { Llm } from "./llm.ts";

/** One saved step: the action, and for targeted actions the element's role + label (ids change between visits). */
export interface WfStep { action: Action; el?: { role: string; text: string } }
export interface Workflow { id?: number; name: string; goal: string; startUrl: string; steps: WfStep[]; source: "run" | "demo" }

const KEEP = new Set(["click", "submit", "purchase", "delete", "login", "type", "press", "scroll", "goto", "wait"]);

/** The executed, successful page steps of an episode (tools, refusals, failures and dry steps are left out). */
export function fromEpisode(ep: Episode, name: string, startUrl: string): Workflow {
  const steps = ep.steps
    .filter((s) => s.action && s.ok && KEEP.has(s.action.type) && !s.output?.startsWith("dry run"))
    .filter((s) => !("target" in s.action!) || s.el)
    .map((s) => ({ action: s.action!, ...(s.el ? { el: s.el } : {}) }));
  return { name: name.trim().slice(0, 80) || ep.goal.slice(0, 80), goal: ep.goal, startUrl, steps, source: "run" };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
/** The element on this page that best matches a saved one: same role and label, else same role and label prefix. */
export function resolveEl(els: PageElement[], el: { role: string; text: string }): PageElement | undefined {
  const t = norm(el.text);
  const same = els.filter((e) => e.role === el.role);
  return same.find((e) => norm(e.text) === t) ?? (t ? same.find((e) => norm(e.text).startsWith(t.slice(0, 24)) || t.startsWith(norm(e.text).slice(0, 24) || "\u0000")) : undefined);
}

/** A scripted Llm that answers the next saved step (targets resolved on the live page), then done. */
export function workflowLlm(wf: Workflow): Llm {
  return {
    async decide({ obs, history }) {
      const i = history.filter((s) => s.action).length;
      if (i >= wf.steps.length) return JSON.stringify({ type: "done", result: `workflow "${wf.name}" replayed (${wf.steps.length} steps)` });
      const st = wf.steps[i];
      if (!("target" in st.action)) return JSON.stringify({ ...st.action, why: `saved step ${i + 1}` });
      const e = st.el && resolveEl(obs.elements, st.el);
      if (!e) return JSON.stringify({ type: "fail", reason: `step ${i + 1}: could not find ${st.el?.role ?? "element"} "${st.el?.text ?? ""}" on this page` });
      return JSON.stringify({ ...st.action, target: e.id, why: `saved step ${i + 1}: ${st.el!.role} "${st.el!.text.slice(0, 40)}"` });
    },
  };
}

// Editing helpers for the step list.
export const removeStep = (wf: Workflow, i: number): Workflow => ({ ...wf, steps: wf.steps.filter((_, n) => n !== i) });
export function moveStep(wf: Workflow, i: number, by: -1 | 1): Workflow {
  const j = i + by, s = [...wf.steps];
  if (i < 0 || j < 0 || i >= s.length || j >= s.length) return wf;
  [s[i], s[j]] = [s[j], s[i]];
  return { ...wf, steps: s };
}
export function setStepText(wf: Workflow, i: number, text: string): Workflow {
  return { ...wf, steps: wf.steps.map((s, n) => (n === i && s.action.type === "type" ? { ...s, action: { ...s.action, text: text.slice(0, 2000) } } : s)) };
}

/** Tolerant read of a stored steps column. */
export function parseSteps(json: string): WfStep[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((s) => s && typeof s === "object" && s.action && typeof s.action.type === "string" && KEEP.has(s.action.type)) : [];
  } catch { return []; }
}
