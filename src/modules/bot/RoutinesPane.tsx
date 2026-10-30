import { useRef, useState } from "react";
import { EmptyState, Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import { continueAfter, itemLabel, newId, removeById, upsertRoutine, type Routine, type RoutineItem } from "./library";
import type { useBotRun } from "./useBotRun";
import type { More } from "./useMore";
import type { Workflow } from "./workflow";

/** Routines: saved workflows / goals run one after another on Run (each with the normal gates and confirms). */
export function RoutinesPane({ more, workflows, bot, run, busy }: { more: More; workflows: Workflow[]; bot: ReturnType<typeof useBotRun>; run: ModuleState["run"]; busy: boolean }) {
  const [draft, setDraft] = useState<Routine>({ id: "", name: "", items: [], continueOnFail: false });
  const [add, setAdd] = useState("");
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState("");
  const stopped = useRef(false);
  const wfName = (id: number) => workflows.find((w) => w.id === id)?.name;
  const put = async (list: Routine[]) => { if ((await run("save_routines", { list })) !== undefined) void more.reload(); };
  const push = (it: RoutineItem) => setDraft((d) => ({ ...d, items: [...d.items, it].slice(0, 20) }));
  const go = async (r: Routine) => {
    stopped.current = false;
    for (let i = 0; i < r.items.length; i++) {
      if (stopped.current) { setStatus(`"${r.name}" stopped.`); return; }
      const it = r.items[i];
      const wf = it.kind === "workflow" ? workflows.find((w) => w.id === it.id) : undefined;
      if (it.kind === "workflow" && !wf) { setStatus(`Step ${i + 1}: that workflow was deleted.`); if (!r.continueOnFail) return; continue; }
      setStatus(`"${r.name}": step ${i + 1} of ${r.items.length} - ${itemLabel(it, wfName)}`);
      const res = await bot.start(wf ? wf.goal : (it as { goal: string }).goal, { preApproved: false, workflow: wf });
      if (!continueAfter(res?.episode.outcome ?? null, r.continueOnFail)) { setStatus(`"${r.name}" ended at step ${i + 1} (${res?.episode.outcome ?? "error"}).`); return; }
    }
    setStatus(`"${r.name}" finished all ${r.items.length} steps.`);
  };
  return (
    <div className="bot-goal">
      <input className="ui-file-text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Routine name" aria-label="Routine name" />
      <div className="ui-quickadd">
        <select className="ui-select" value={add} onChange={(e) => setAdd(e.target.value)} aria-label="Workflow to add">
          <option value="">Add a saved workflow...</option>
          {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button type="button" className="ui-btn" disabled={!add} onClick={() => { push({ kind: "workflow", id: Number(add) }); setAdd(""); }}>Add</button>
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="or a goal" aria-label="Goal to add" />
        <button type="button" className="ui-btn" disabled={!goal.trim()} onClick={() => { push({ kind: "goal", goal: goal.trim() }); setGoal(""); }}>Add goal</button>
      </div>
      {draft.items.length > 0 && <ol className="bot-steps">{draft.items.map((it, i) => (
        <li key={i}>{itemLabel(it, wfName)} <button type="button" className="ui-btn" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, n) => n !== i) })}>Remove</button></li>
      ))}</ol>}
      <div className="ui-controls">
        <label className="schedule-toggle"><input type="checkbox" checked={draft.continueOnFail} onChange={(e) => setDraft({ ...draft, continueOnFail: e.target.checked })} /> Keep going after a step that does not finish</label>
        <button type="button" className="ui-btn" disabled={busy || !draft.items.length} onClick={() => void put(upsertRoutine(more.routines, { ...draft, id: draft.id || newId(Date.now(), Math.random()) })).then(() => setDraft({ id: "", name: "", items: [], continueOnFail: false }))}>{draft.id ? "Save changes" : "Save routine"}</button>
      </div>
      {status && <p className="ui-meta" role="status">{status}</p>}
      {more.routines.length === 0 ? <EmptyState title="No routines" hint="A routine runs its workflows and goals in order when you press Run." /> : more.routines.map((r) => (
        <Row key={r.id} end={<span className="ui-actions">
          {bot.running ? <button type="button" className="ui-btn" onClick={() => { stopped.current = true; bot.stop(); }}>Stop</button>
            : <button type="button" className="ui-btn" onClick={() => void go(r)}>Run</button>}
          <button type="button" className="ui-btn" disabled={busy || bot.running} onClick={() => setDraft(r)}>Edit</button>
          <ConfirmButton label="Delete" disabled={busy || bot.running} onConfirm={() => void put(removeById(more.routines, r.id))} />
        </span>}><strong>{r.name}</strong> <span className="ui-meta">{r.items.length} steps</span></Row>
      ))}
    </div>
  );
}
