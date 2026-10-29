import { useEffect, useState } from "react";
import type { ModuleState } from "../../ui/useModule";
import { recentEvents, type EventRow } from "./netOps";

// Change detector: new devices and IP changes recorded at each scan.
export function EventsList({ busy, run }: { busy: boolean; run: ModuleState["run"] }) {
  const [ev, setEv] = useState<EventRow[]>([]);
  useEffect(() => { if (!busy) recentEvents().then(setEv).catch(() => setEv([])); }, [busy]);
  const unseen = ev.filter((e) => !e.seen).length;
  return (
    <div>
      <div className="ui-actions">
        <span className="ui-meta">{unseen} unseen change(s)</span>
        <button type="button" className="ui-btn ui-sm" disabled={busy || !unseen} onClick={() => void run("mark_events_seen")}>Mark all seen</button>
      </div>
      <ul className="hn-list">
        {ev.map((e) => <li key={e.id} className={`hn-ev${e.seen ? "" : " unseen"}`}><b>{e.kind}</b> {e.mac} · {e.detail} <span className="ui-meta">{e.at}</span></li>)}
        {!ev.length && <li className="ui-meta">No changes recorded yet.</li>}
      </ul>
    </div>
  );
}
