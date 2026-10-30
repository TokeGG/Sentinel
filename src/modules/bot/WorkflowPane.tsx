import { useState } from "react";
import { EmptyState, Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import { DemoBox } from "./DemoBox";
import type { useBotRun } from "./useBotRun";
import { WorkflowEditor } from "./WorkflowEditor";
import { RecipeBox } from "./RecipeBox";
import type { SiteNote } from "./siteNotes";
import type { Workflow } from "./workflow";

/** Saved workflows: replay (same gates and confirms as a live run), edit, delete; record new ones by demo. */
export function WorkflowPane({ list, sites = [], bot, run, busy, reload }: { list: Workflow[]; sites?: SiteNote[]; bot: ReturnType<typeof useBotRun>; run: ModuleState["run"]; busy: boolean; reload(): void }) {
  const [edit, setEdit] = useState<Workflow | null>(null);
  const [step, setStep] = useState(false);
  const go = async (skill: string, args: Record<string, unknown>) => { if ((await run(skill, args)) !== undefined) { setEdit(null); reload(); } };
  if (edit) return <WorkflowEditor wf={edit} busy={busy} onCancel={() => setEdit(null)} onSave={(w) => void go("update_workflow", { ...w })} />;
  return (
    <div className="bot-goal">
      <p className="ui-meta">Steps from a finished run ("Save as workflow") or a demo. Replays ask before irreversible actions like a normal run.</p>
      <label className="schedule-toggle"><input type="checkbox" checked={step} onChange={(e) => setStep(e.target.checked)} /> Approve each replayed step</label>
      {list.length === 0 ? <EmptyState title="No saved workflows" /> : list.map((w) => (
        <Row key={w.id} end={<span className="ui-actions">
          <button type="button" className="ui-btn" disabled={bot.running} onClick={() => void bot.start(w.goal, { preApproved: false, stepApproval: step, workflow: w })}>Replay</button>
          <button type="button" className="ui-btn" disabled={busy} onClick={() => setEdit(w)}>Edit</button>
          <ConfirmButton label="Delete" disabled={busy} onConfirm={() => void go("delete_workflow", { id: w.id })} />
        </span>}>
          <strong>{w.name}</strong> <span className="ui-meta">{w.steps.length} steps{w.source === "demo" ? ", from a demo" : ""}</span>
        </Row>
      ))}
      <DemoBox run={run} busy={busy || bot.running} reload={reload} />
      <RecipeBox list={list} sites={sites} run={run} busy={busy} reload={reload} />
    </div>
  );
}
