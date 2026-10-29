import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { EmptyState } from "../../ui/kit";
import type { ModuleRow } from "../../ui/useModule";
import { taskTree, whenText } from "./taskLogic";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;

function Task({ r, now, busy, run, onEdit, sub }: { r: ModuleRow; now: Date; busy: boolean; run: Run; onEdit(r: ModuleRow): void; sub?: boolean }) {
  return (
    <li className={`cal-item${r.done ? " done" : ""}${sub ? " sub" : ""}`}>
      <input type="checkbox" className="cal-check" aria-label="Done" checked={r.done === true} disabled={busy} onChange={() => void run("toggle_done", { id: r.itemId })} />
      <span className="cal-text">
        {String(r.text)}
        <small>{whenText(r, now)}{r.notes ? ` · ${String(r.notes)}` : ""}</small>
      </span>
      <span className="cal-acts">
        <button type="button" className="ui-btn ui-sm" disabled={busy} onClick={() => onEdit(r)}>Edit</button>
        <ConfirmButton label="Delete" className="ui-btn ui-sm" disabled={busy} title={sub ? undefined : "Also deletes its subtasks"} onConfirm={() => void run("delete_item", { id: r.itemId })} />
      </span>
    </li>
  );
}

function AddSub({ parent, busy, run }: { parent: unknown; busy: boolean; run: Run }) {
  const [t, setT] = useState("");
  return (
    <form className="cal-sub" onSubmit={async (e) => { e.preventDefault(); if (t.trim() && (await run("add_item", { kind: "task", title: t, parent_id: parent })) !== undefined) setT(""); }}>
      <input className="ui-file-text" value={t} onChange={(e) => setT(e.target.value)} placeholder="+ subtask" aria-label="Add subtask" disabled={busy} />
    </form>
  );
}

export function TasksList({ rows, now, busy, run, onEdit }: { rows: ModuleRow[]; now: Date; busy: boolean; run: Run; onEdit(r: ModuleRow): void }) {
  const tree = taskTree(rows);
  if (!tree.length) return <EmptyState title="No tasks yet" hint='Quick add "buy milk" (no date makes a task).' />;
  return (
    <ul className="cal-list">
      {tree.map(({ task, subs }) => (
        <li key={String(task.id)} className="cal-task">
          <ul className="cal-list">
            <Task r={task} now={now} busy={busy} run={run} onEdit={onEdit} />
            {subs.map((s) => <Task key={String(s.id)} r={s} now={now} busy={busy} run={run} onEdit={onEdit} sub />)}
          </ul>
          <AddSub parent={task.itemId} busy={busy} run={run} />
        </li>
      ))}
    </ul>
  );
}
