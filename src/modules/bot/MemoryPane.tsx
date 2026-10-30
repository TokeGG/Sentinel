import { useState } from "react";
import { EmptyState, Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import type { Note } from "./knowledge";
import type { LearnState } from "./learn";
import { clearSummary, lessonRows } from "./memory";

/** Bot memory: edit/delete notes, delete learned lessons, clear everything (site notes live in Site notebook). */
export function MemoryPane({ notes, state, sites, run, busy, reload }: { notes: Note[]; state: LearnState | null; sites: number; run: ModuleState["run"]; busy: boolean; reload(): void }) {
  const [edit, setEdit] = useState<Note | null>(null);
  const lessons = lessonRows(state?.lessons ?? {});
  const go = async (skill: string, args?: Record<string, unknown>) => { if ((await run(skill, args)) !== undefined) { setEdit(null); reload(); } };
  return (
    <div className="bot-goal">
      {edit && (
        <>
          <input className="ui-file-text" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} aria-label="Note title" />
          <textarea className="ui-file-text" rows={5} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} aria-label="Note text" />
          <div className="ui-actions">
            <button type="button" className="ui-btn primary" disabled={busy || !edit.text.trim()} onClick={() => void go("update_note", { id: edit.id, title: edit.title, text: edit.text })}>Save note</button>
            <button type="button" className="ui-btn" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </>
      )}
      <h4 className="ui-meta">Notes ({notes.length})</h4>
      {notes.length === 0 ? <EmptyState title="No notes" /> : notes.map((n) => (
        <Row key={n.id} end={<span className="ui-actions">
          <button type="button" className="ui-btn" disabled={busy} onClick={() => setEdit(n)}>Edit</button>
          <ConfirmButton label="Delete" disabled={busy} onConfirm={() => void go("delete_note", { id: n.id })} />
        </span>}><strong>{n.title}</strong> <span className="ui-meta">{n.text.slice(0, 80)}</span></Row>
      ))}
      <h4 className="ui-meta">Learned lessons ({lessons.length})</h4>
      {lessons.length === 0 ? <p className="ui-meta">None yet.</p> : lessons.map((l) => (
        <Row key={l.key} end={<ConfirmButton label="Delete" disabled={busy} onConfirm={() => void go("delete_lesson", { key: l.key })} />}>
          <strong>{l.key}</strong> <span className="ui-meta">value {l.value}, weight {l.weight}</span>
        </Row>
      ))}
      <p className="ui-meta">{clearSummary({ notes: notes.length, sites, lessons: lessons.length })}</p>
      <ConfirmButton label="Clear bot memory" disabled={busy} onConfirm={() => void go("clear_memory")} />
    </div>
  );
}
