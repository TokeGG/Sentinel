// Reminders: add with date + time; while the panel is open, due ones float on top with Snooze / Done.
import { useEffect, useState } from "react";
import { ErrorLine, Row } from "../../ui/kit";
import { useStore } from "../../ui/useStore";
import { addReminder, deleteReminder, doneReminder, listReminders, snoozeReminder } from "./extraStore";
import { dueReminders, localStamp, reminderDue, SNOOZES, snoozeTo } from "./reminders";

export const useReminders = () => useStore(listReminders, []);
type Store = ReturnType<typeof useReminders>;

/** In-app floating reminders (panel only; nothing runs when the panel is closed). */
export function FloatingReminders({ s }: { s: Store }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  const due = dueReminders(s.data, now);
  if (!due.length) return null;
  return (
    <div className="cal-float" role="alertdialog" aria-label="Reminders">
      {due.slice(0, 3).map((r) => (
        <div key={r.id} className="cal-floatrow">
          <strong>{r.title}</strong>
          {SNOOZES.map((m) => <button key={m} type="button" className="ui-btn ui-sm" onClick={() => void s.act(() => snoozeReminder(r.id, snoozeTo(new Date(), m)))}>Snooze {m}m</button>)}
          <button type="button" className="ui-btn ui-sm primary" onClick={() => void s.act(() => doneReminder(r.id))}>Done</button>
        </div>
      ))}
    </div>
  );
}

export function RemindersTab({ s }: { s: Store }) {
  const t = localStamp(new Date(Date.now() + 3_600_000));
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(t.slice(0, 10));
  const [time, setTime] = useState(t.slice(11));
  return (
    <div className="cal-form">
      <form className="cal-fields" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void s.act(async () => { await addReminder(title.trim(), reminderDue(day, time)); setTitle(""); }); }}>
        <input placeholder="Remind me to…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <button type="submit" className="ui-btn primary" disabled={s.busy}>Add reminder</button>
      </form>
      <p className="ui-meta">Reminders pop up inside this panel while it is open. No background notifications.</p>
      {s.error && <ErrorLine message={s.error} />}
      {s.data.map((r) => (
        <Row key={r.id} end={<button type="button" className="ui-btn ui-sm" onClick={() => void s.act(() => deleteReminder(r.id))}>Remove</button>}>
          <span className={r.done ? "cal-donetext" : ""}>{r.due_at.replace("T", " ")} · {r.title}</span>
        </Row>
      ))}
    </div>
  );
}
