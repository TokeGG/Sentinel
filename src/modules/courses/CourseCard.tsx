import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { openLink } from "../../ui/openLink";
import type { ModuleState } from "../../ui/useModule";
import { CourseForm } from "./CourseForm";
import { pct, type Course } from "./logic";

type Props = { c: Course; busy: boolean; run: ModuleState["run"]; logMins: number; today: string };

/** One course: progress, next lesson, dates (to Calendar), notes and a quick study-time log. */
export function CourseCard({ c, busy, run, logMins, today }: Props) {
  const [edit, setEdit] = useState(false);
  const [date, setDate] = useState({ label: "", date: "", kind: "due" });
  const [mins, setMins] = useState<number | null>(null);
  const [sent, setSent] = useState<number[]>([]);
  if (edit) return <div className="co-card"><CourseForm course={c} busy={busy} onSave={async (d) => { await run("save_course", { ...c, ...d }); setEdit(false); }} onCancel={() => setEdit(false)} /></div>;
  const p = pct(c);
  const toCal = async (i: number) => { await run("to_calendar", { id: c.id, index: i }); setSent([...sent, i]); };
  return (
    <article className="co-card">
      <header className="co-head">
        <b>{c.name}</b>
        {c.provider && <span className="ui-meta">{c.provider}</span>}
        {c.url && <button type="button" className="ui-link" onClick={() => void openLink(c.url)}>Open</button>}
      </header>
      <div className="co-bar" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${p}%` }} /></div>
      <div className="co-pair">
        <span>{c.done} of {c.total} lessons ({p}%)</span>
        <button type="button" className="ui-btn" disabled={busy || c.done <= 0} onClick={() => void run("step", { id: c.id, delta: -1 })} aria-label="One lesson less">-1</button>
        <button type="button" className="ui-btn primary" disabled={busy || c.done >= c.total} onClick={() => void run("step", { id: c.id, delta: 1 })}>Finished a lesson</button>
      </div>
      {c.next && <p>Next: {c.next}</p>}
      {c.dates.length > 0 && (
        <ul className="co-dates">
          {c.dates.map((d, i) => (
            <li key={i} className={d.date < today ? "past" : ""}>
              <span>{d.kind === "exam" ? "Exam" : "Due"} {d.date}: {d.label}</span>
              <button type="button" className="ui-link" disabled={busy || sent.includes(i)} onClick={() => void toCal(i)}>{sent.includes(i) ? "In calendar" : "To calendar"}</button>
              <button type="button" className="ui-link" disabled={busy} onClick={() => void run("remove_date", { id: c.id, index: i })}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <form className="co-pair" onSubmit={(e) => { e.preventDefault(); void run("add_date", { id: c.id, ...date }).then(() => setDate({ label: "", date: "", kind: "due" })); }}>
        <select className="ui-input" value={date.kind} onChange={(e) => setDate({ ...date, kind: e.target.value })} aria-label="Date type"><option value="due">Due</option><option value="exam">Exam</option></select>
        <input className="ui-input" value={date.label} onChange={(e) => setDate({ ...date, label: e.target.value })} placeholder="What (e.g. Essay 2)" aria-label="What is due" />
        <input className="ui-input" type="date" value={date.date} onChange={(e) => setDate({ ...date, date: e.target.value })} aria-label="Date" />
        <button type="submit" className="ui-btn" disabled={busy || !date.date}>Add date</button>
      </form>
      <form className="co-pair" onSubmit={(e) => { e.preventDefault(); void run("log_time", { id: c.id, date: today, mins: mins ?? logMins }); }}>
        <input className="ui-input" type="number" min={1} value={mins ?? logMins} onChange={(e) => setMins(Number(e.target.value))} aria-label="Minutes studied" />
        <button type="submit" className="ui-btn" disabled={busy}>Log study time today</button>
      </form>
      {c.notes && <p className="co-notes">{c.notes}</p>}
      <div className="co-pair">
        <button type="button" className="ui-btn" onClick={() => setEdit(true)}>Edit</button>
        <ConfirmButton label="Delete" disabled={busy} onConfirm={() => void run("delete_course", { id: c.id })} />
      </div>
    </article>
  );
}
