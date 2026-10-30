// Dry-run preview of a scheduled job before it may be switched on: what a dry run of it planned and the first step it
// would take, plus the job rules (hidden, irreversible actions denied). Pure.
import { isIrreversible, type Episode } from "./actions.ts";
import type { Job } from "./jobs.ts";
import { describeAction } from "./logging.ts";
import { planLines } from "./plan.ts";

export function previewLines(job: Pick<Job, "name" | "goal" | "workflow_id" | "every_minutes">, ep: Episode, wfSteps?: number): string[] {
  const out = [`Job "${job.name}" every ${job.every_minutes} min: ${job.workflow_id ? `replays a saved workflow (${wfSteps ?? "?"} steps)` : `goal "${job.goal.slice(0, 120)}"`}`];
  if (ep.plan) out.push(...planLines(ep.plan).split("\n").filter(Boolean));
  const first = ep.steps.find((s) => s.action);
  if (first?.action) {
    out.push(`First step: ${describeAction(first.action)}${first.why ? ` (${first.why})` : ""}`);
    if (isIrreversible(first.action)) out.push("That step is irreversible: as a job it would be DENIED, so the job would stop there.");
  } else if (ep.result) out.push(`The model would stop at once: ${ep.result.slice(0, 200)}`);
  else out.push(`No first step (${ep.steps[0]?.error ?? ep.outcome}).`);
  out.push("As a job it runs hidden and every submit/purchase/delete/login is denied.");
  return out;
}

/** Turning a job ON needs a preview of it in this panel session; turning it off never does. */
export const canEnable = (jobId: number, on: boolean, previewed: ReadonlySet<number>) => !on || previewed.has(jobId);
