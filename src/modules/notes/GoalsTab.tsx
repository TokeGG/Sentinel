import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { useStore } from "../../ui/useStore";
import { goalPct, milestonesFrom, parseMilestones, toggleMs } from "./prod";
import { addGoal, deleteGoal, listGoals, saveMilestones } from "./prodStore";

/** Goals with milestones (one per line); progress = milestones done. */
export function GoalsTab() {
  const goals = useStore(listGoals, []);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [ms, setMs] = useState("");
  return (
    <div className="nt-goals">
      {goals.error && <div className="ui-error">{goals.error}</div>}
      <form className="nt-goalform" onSubmit={(e) => { e.preventDefault(); const t = title.trim(), m = milestonesFrom(ms); setTitle(""); setMs(""); void goals.act(() => addGoal(t, date, m)); }}>
        <input placeholder="Goal" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Goal" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Target date" />
        <textarea rows={3} placeholder="Milestones, one per line" value={ms} onChange={(e) => setMs(e.target.value)} aria-label="Milestones" />
        <button className="ui-btn" disabled={!title.trim()}>Add goal</button>
      </form>
      {goals.data.map((g) => {
        const list = parseMilestones(g.milestones);
        return (
          <div key={g.id} className="nt-goal">
            <b>{g.title}</b> <span className="ui-meta">{goalPct(list)}%{g.target_date && ` · by ${g.target_date}`}</span>
            <ConfirmButton label="Delete" className="ui-btn ui-sm" onConfirm={() => void goals.act(() => deleteGoal(g.id))} />
            <div className="nt-meter"><i style={{ width: `${goalPct(list)}%` }} /></div>
            {list.map((m, i) => <label key={i}><input type="checkbox" checked={m.done} onChange={() => void goals.act(() => saveMilestones(g.id, toggleMs(list, i)))} /> {m.t}</label>)}
          </div>
        );
      })}
    </div>
  );
}
