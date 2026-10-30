import { useState } from "react";
import { EmptyState, Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import type { Job } from "./jobs";
import type { JobRun } from "./storeExtras";
import type { Workflow } from "./workflow";
import { canEnable, previewLines } from "./jobPreview";
import type { useBotRun } from "./useBotRun";

const EVERY = [[60, "hourly"], [360, "every 6 h"], [1440, "daily"], [10080, "weekly"]] as const;

/** Scheduled jobs: each off until switched on, and only while the module's Auto-refresh toggle is on. */
export function JobsPane({ bot, jobs, runs, workflows, run, busy, reload }: { bot: ReturnType<typeof useBotRun>; jobs: Job[]; runs: JobRun[]; workflows: Workflow[]; run: ModuleState["run"]; busy: boolean; reload(): void }) {
  const [f, setF] = useState({ name: "", goal: "", workflowId: "", every: "1440" });
  const go = async (skill: string, args: Record<string, unknown>) => { if ((await run(skill, args)) !== undefined) reload(); };
  const [previewed, setPreviewed] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<{ id: number; lines: string[] } | null>(null);
  const dry = async (j: Job) => {
    const wf = j.workflow_id ? workflows.find((w) => w.id === j.workflow_id) : undefined;
    if (j.workflow_id && !wf) { setPreview({ id: j.id, lines: ["Its saved workflow was deleted; this job would fail."] }); return; }
    const r = await bot.start(j.goal, { preApproved: false, dryRun: true, workflow: wf });
    if (!r) { setPreview({ id: j.id, lines: ["The dry run could not start (see the Run section for the error)."] }); return; }
    setPreview({ id: j.id, lines: previewLines(j, r.episode, wf?.steps.length) });
    setPreviewed((s) => new Set(s).add(j.id));
  };
  return (
    <div className="bot-goal">
      <p className="ui-meta">Preview (a dry run: plan + first step, nothing done) is needed before a job can be switched on. Jobs run hidden and never do irreversible actions. They run only when BOTH the module's Auto-refresh toggle (customize) and the job's own switch are on.</p>
      <input className="ui-file-text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Job name" aria-label="Job name" />
      <input className="ui-file-text" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="Goal (or pick a workflow)" aria-label="Job goal" />
      <div className="ui-quickadd">
        <select className="ui-select" value={f.workflowId} onChange={(e) => setF({ ...f, workflowId: e.target.value })} aria-label="Workflow">
          <option value="">No workflow (model decides)</option>
          {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select className="ui-select" value={f.every} onChange={(e) => setF({ ...f, every: e.target.value })} aria-label="How often">
          {EVERY.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
        <button type="button" className="ui-btn" disabled={busy || (!f.goal.trim() && !f.workflowId)} onClick={() => void go("add_job", { ...f, every: Number(f.every) }).then(() => setF({ ...f, name: "", goal: "" }))}>Add job</button>
      </div>
      {jobs.length === 0 ? <EmptyState title="No jobs" /> : jobs.map((j) => (
        <Row key={j.id} end={<span className="ui-actions">
          <label className="schedule-toggle"><input type="checkbox" checked={j.enabled === 1} disabled={busy || (j.enabled !== 1 && !canEnable(j.id, true, previewed))} title={canEnable(j.id, true, previewed) ? "" : "Preview it first"} onChange={(e) => void go("enable_job", { id: j.id, enabled: e.target.checked })} /> On</label>
          <button type="button" className="ui-btn" disabled={busy || bot.running} onClick={() => void dry(j)}>Preview</button>
          <ConfirmButton label="Delete" disabled={busy} onConfirm={() => void go("delete_job", { id: j.id })} />
        </span>}>
          <strong>{j.name}</strong> <span className="ui-meta">every {j.every_minutes} min; last {j.last_run ?? "never"}</span>
        </Row>
      ))}
      {preview && <div role="status"><ul className="bot-steps">{preview.lines.map((l, i) => <li key={i}>{l}</li>)}</ul><button type="button" className="ui-btn" onClick={() => setPreview(null)}>Close preview</button></div>}
      <h4 className="ui-meta">Run history</h4>
      {runs.length === 0 ? <p className="ui-meta">None yet.</p> : runs.slice(0, 15).map((r) => <Row key={r.id}><span className="ui-meta">{r.at}</span> {r.name ?? `job ${r.job_id}`}: {r.summary || r.outcome}</Row>)}
    </div>
  );
}
