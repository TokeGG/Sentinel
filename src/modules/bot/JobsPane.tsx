import { useState } from "react";
import { EmptyState, Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import type { Job } from "./jobs";
import type { JobRun } from "./storeExtras";
import type { Workflow } from "./workflow";

const EVERY = [[60, "hourly"], [360, "every 6 h"], [1440, "daily"], [10080, "weekly"]] as const;

/** Scheduled jobs: each off until switched on, and only while the module's Auto-refresh toggle is on. */
export function JobsPane({ jobs, runs, workflows, run, busy, reload }: { jobs: Job[]; runs: JobRun[]; workflows: Workflow[]; run: ModuleState["run"]; busy: boolean; reload(): void }) {
  const [f, setF] = useState({ name: "", goal: "", workflowId: "", every: "1440" });
  const go = async (skill: string, args: Record<string, unknown>) => { if ((await run(skill, args)) !== undefined) reload(); };
  return (
    <div className="bot-goal">
      <p className="ui-meta">Jobs run hidden and never do irreversible actions. They run only when BOTH the module's Auto-refresh toggle (customize) and the job's own switch are on.</p>
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
          <label className="schedule-toggle"><input type="checkbox" checked={j.enabled === 1} disabled={busy} onChange={(e) => void go("enable_job", { id: j.id, enabled: e.target.checked })} /> On</label>
          <ConfirmButton label="Delete" disabled={busy} onConfirm={() => void go("delete_job", { id: j.id })} />
        </span>}>
          <strong>{j.name}</strong> <span className="ui-meta">every {j.every_minutes} min; last {j.last_run ?? "never"}</span>
        </Row>
      ))}
      <h4 className="ui-meta">Run history</h4>
      {runs.length === 0 ? <p className="ui-meta">None yet.</p> : runs.slice(0, 15).map((r) => <Row key={r.id}><span className="ui-meta">{r.at}</span> {r.name ?? `job ${r.job_id}`}: {r.summary || r.outcome}</Row>)}
    </div>
  );
}
