// Progress: streak, topics practised, recent attempts.
import { useEffect, useState } from "react";
import { attempts, type AttemptRow } from "./coachStore";
import { streak, topicCounts, yourTurnCount } from "./progress";

export function ProgressPane() {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  useEffect(() => { void attempts().then(setRows, () => setRows([])); }, []);
  const topics = topicCounts(rows);
  return (
    <div className="coach-col">
      <div className="coach-row"><b>{streak(rows.map((r) => r.created_at), new Date())} day streak</b><span className="bot-dim">{rows.length} attempts, {yourTurnCount(rows)} on your own</span></div>
      {topics.length > 0 && <div>Topics: {topics.slice(0, 12).map(([t, n]) => `${t} (${n})`).join(", ")}</div>}
      <ul className="bot-steps">{rows.slice(0, 15).map((r) => <li key={r.id}>{r.created_at.slice(0, 10)} {r.mode === "yours" ? "you" : "coach"}: {r.title.slice(0, 50)} - {r.result.slice(0, 60)}</li>)}</ul>
    </div>
  );
}
