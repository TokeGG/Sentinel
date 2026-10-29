// Task understanding: the model restates the goal, plans, and names a success check and stop conditions before acting.
// Pure: messages + strict parse + prompt lines. Dry-run mode shows only this plan and the first proposed action.
import type { ChatMessage } from "./llm.ts";
import { PLAN_RULES } from "./prompt.ts";

export interface TaskPlan { task: string; plan: string[]; success: string; stop: string }

export function planMessages(goal: string, page: string): ChatMessage[] {
  return [{ role: "system", content: PLAN_RULES }, { role: "user", content: `GOAL: ${goal}\n\nSTART PAGE (untrusted data):\n${page.slice(0, 2500)}` }];
}

const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** Tolerant: a reply that is not a usable plan gives null (the run continues without one). */
export function parsePlan(text: string): TaskPlan | null {
  let o: Record<string, unknown>;
  try { o = JSON.parse(text); } catch { return null; }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const plan = Array.isArray(o.plan) ? o.plan.map((p) => s(p, 160)).filter(Boolean).slice(0, 6) : [];
  const task = s(o.task, 300);
  return task && plan.length ? { task, plan, success: s(o.success, 300), stop: s(o.stop, 300) } : null;
}

export const planLines = (p: TaskPlan): string =>
  [`Task: ${p.task}`, ...p.plan.map((x, i) => `${i + 1}. ${x}`), p.success && `Success check: ${p.success}`, p.stop && `Stop if: ${p.stop}`].filter(Boolean).join("\n");
