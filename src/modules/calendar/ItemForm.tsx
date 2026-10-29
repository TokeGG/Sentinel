// Add / edit form for the calendar's own events and tasks, with a one-line
// natural-language quick add ("lunch Friday 1pm") that previews what it understood.
import { useState } from "react";
import { REPEATS, repeatOf, type Repeat } from "./recur";
import { parseQuick } from "./quickParse";
import { previewQuick, quickArgs } from "./taskLogic";

const LABEL: Record<Repeat, string> = { none: "Does not repeat", daily: "Every day", weekly: "Every week", monthly: "Every month" };
type Row = Record<string, unknown>;
type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;

export function ItemForm({ editing, busy, run, onDone }: { editing: Row | null; busy: boolean; run: Run; onDone(): void }) {
  const at = String(editing?.startsAt ?? "");
  const [quick, setQuick] = useState("");
  const [kind, setKind] = useState(String(editing?.itemKind ?? "event"));
  const [title, setTitle] = useState(String(editing?.title ?? ""));
  const [day, setDay] = useState(at.slice(0, 10));
  const [time, setTime] = useState(at.length > 10 ? at.slice(11, 16) : "");
  const [repeat, setRepeat] = useState<Repeat>(repeatOf(editing?.rrule as string | undefined));
  const [notes, setNotes] = useState(String(editing?.notes ?? ""));
  const [open, setOpen] = useState(!!editing);
  const q = quick.trim() ? parseQuick(quick) : null;

  const reset = () => { setQuick(""); setTitle(""); setDay(""); setTime(""); setRepeat("none"); setNotes(""); onDone(); };
  const submit = async (skill: string, args: Record<string, unknown>) => {
    if ((await run(skill, args)) !== undefined) reset();
  };
  return (
    <div className="cal-form">
      {!editing && (
        <form className="ui-quickadd" onSubmit={(e) => { e.preventDefault(); if (q) void submit("add_item", quickArgs(q)); }}>
          <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder='Quick add: "lunch Friday 1pm", "buy milk", "pay rent every month"' aria-label="Quick add" disabled={busy} />
          <button type="submit" className="ui-btn primary" disabled={busy || !q}>Add</button>
        </form>
      )}
      {q && <span className="ui-meta" role="status">{q.title} → {previewQuick(q)}</span>}
      {!editing && <button type="button" className="ui-btn ui-sm cal-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide details" : "Details…"}</button>}
      {open && (
        <form
          className="cal-fields"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(editing ? "update_item" : "add_item", { id: editing?.itemId, parent_id: editing?.parentId, kind, title, day, time, repeat, notes });
          }}
        >
          <select className="ui-select" aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy || !!editing}>
            <option value="event">Event</option>
            <option value="task">Task</option>
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" disabled={busy} />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Date" disabled={busy} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (empty = all day)" disabled={busy} />
          <select className="ui-select" aria-label="Repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} disabled={busy}>
            {REPEATS.map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}
          </select>
          <input className="cal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" aria-label="Notes" disabled={busy} />
          <button type="submit" className="ui-btn primary" disabled={busy || !title.trim()}>{editing ? "Save" : "Add"}</button>
          {editing && <button type="button" className="ui-btn" onClick={onDone}>Cancel</button>}
        </form>
      )}
    </div>
  );
}
