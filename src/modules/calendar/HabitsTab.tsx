// Habits: one row per habit, the last 14 days as checkboxes, current and best streak.
import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { ErrorLine } from "../../ui/kit";
import { useStore } from "../../ui/useStore";
import { addHabit, deleteHabit, listHabits, toggleCheck } from "./extraStore";
import { bestStreak, currentStreak, lastDays } from "./habits";

export function HabitsTab() {
  const s = useStore(listHabits, []);
  const [name, setName] = useState("");
  const now = new Date();
  const days = lastDays(now, 14);
  return (
    <div className="cal-form">
      <form className="cal-fields" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void s.act(async () => { await addHabit(name.trim()); setName(""); }); }}>
        <input placeholder="New habit, e.g. Read 20 minutes" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="ui-btn primary" disabled={s.busy}>Add habit</button>
      </form>
      {s.error && <ErrorLine message={s.error} />}
      {s.data.map((h) => (
        <div key={h.id} className="cal-habit">
          <strong>{h.name}</strong>
          <span className="ui-meta">streak {currentStreak(h.days, now)} · best {bestStreak(h.days)}</span>
          <span className="cal-habitdays">
            {days.map((d) => (
              <input key={d} type="checkbox" title={d} aria-label={`${h.name} ${d}`} checked={h.days.includes(d)} disabled={s.busy}
                onChange={(e) => void s.act(() => toggleCheck(h.id, d, e.target.checked))} />
            ))}
          </span>
          <ConfirmButton label="Delete" className="ui-btn ui-sm" onConfirm={() => void s.act(() => deleteHabit(h.id))} />
        </div>
      ))}
    </div>
  );
}
