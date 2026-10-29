// Scheduled bot jobs (Tauri glue). Called by the manifest's `run_due_jobs` skill, which core/scheduler runs ONLY after
// the user switched on the Bot module's Auto-refresh toggle; each job also has its own switch (off when created).
// Jobs run hidden, with no one to ask: every irreversible action is denied, so a job can never submit/buy/delete/log in.
import { dueJobs, jobSummary } from "./jobs";
import { runBot } from "./runner";
import { getWorkflow, listJobs, recordJobRun } from "./storeExtras";

export async function runDueJobs() {
  const due = dueJobs(await listJobs(), Date.now());
  for (const j of due) {
    try {
      const workflow = j.workflow_id ? (await getWorkflow(j.workflow_id)) ?? undefined : undefined;
      if (j.workflow_id && !workflow) throw new Error("its saved workflow was deleted");
      const r = await runBot({ goal: j.goal, preApproved: false, showWindow: false, signal: new AbortController().signal, log: () => {}, confirm: async () => false, workflow });
      await recordJobRun(j.id, r.episode.outcome, jobSummary(r.episode.outcome, r.episode.result, r.episode.steps.length));
    } catch (e) {
      await recordJobRun(j.id, "error", String((e as Error)?.message ?? e).slice(0, 300));
    }
  }
  return { ok: true, ran: due.length };
}
