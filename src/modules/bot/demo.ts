// Teach-by-demo: events recorded by driver.js (window.__sb.recTake) -> a workflow draft. Pure and defensive: page
// data is untrusted, password fields are dropped here too (driver.js never records them in the first place).
import type { WfStep, Workflow } from "./workflow.ts";

export interface DemoEvent { kind: "click" | "type" | "nav"; role: string; text: string; value?: string; url: string }

const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

export function readEvents(v: unknown): DemoEvent[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 500).flatMap((e: Record<string, unknown>) => {
    const kind = e?.kind;
    if (kind !== "click" && kind !== "type" && kind !== "nav") return [];
    const role = s(e.role, 30);
    if (role === "password") return [];
    return [{ kind, role, text: s(e.text, 100), value: kind === "type" ? s(e.value, 2000) : undefined, url: s(e.url, 2000) }];
  });
}

/** A recorded click that looks irreversible replays as that action type, so the confirm rule still applies. */
export function clickType(role: string, text: string): "click" | "submit" | "purchase" | "delete" | "login" {
  const t = text.toLowerCase();
  if (/\b(buy|pay|order|checkout|purchase)\b/.test(t)) return "purchase";
  if (/\b(delete|remove|erase)\b/.test(t)) return "delete";
  if (/\b(sign in|log in|login|sign on)\b/.test(t)) return "login";
  if (role === "submit" || /\b(send|submit|post|confirm|save|apply|register|sign up)\b/.test(t)) return "submit";
  return "click";
}

/** Consecutive typing into the same field keeps only the last value; a click right after nav-less typing stays. */
export function eventsToWorkflow(events: DemoEvent[], name: string, goal: string): Workflow {
  const steps: WfStep[] = [];
  let startUrl = "";
  for (const e of events) {
    if (!startUrl && e.url) startUrl = e.url;
    if (e.kind === "nav") continue; // navigations follow from the clicks; the start URL opens the replay
    const el = { role: e.role, text: e.text };
    const prev = steps[steps.length - 1];
    if (e.kind === "type") {
      if (prev?.action.type === "type" && prev.el?.role === el.role && prev.el?.text === el.text) { prev.action = { ...prev.action, text: e.value ?? "" }; continue; }
      steps.push({ action: { type: "type", target: "0", text: e.value ?? "" }, el });
    } else steps.push({ action: { type: clickType(e.role, e.text), target: "0" }, el });
  }
  return { name: name.trim().slice(0, 80) || "Demo", goal: goal.trim() || name.trim() || "Replay a recorded demo", startUrl, steps, source: "demo" };
}
