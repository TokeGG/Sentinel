// The Master Hub panel (id hub.master, not a module): every missed notification
// grouped by module (counts only, never message text), mark-all-read, per-module
// snooze / do-not-disturb, jump to the panel, and the notification history.
import { useState } from "react";
import { registry } from "../core/module";
import { EmptyState, ErrorLine, Table } from "../ui/kit";
import { errorText } from "../ui/moduleRun";
import { fmtHM, groupMissed, inQuiet, minutesOfDay, totalOf } from "./notifLogic";
import { openPanel } from "./panelApi";
import { useHub } from "./useHub";
import "./masterhub.css";

const nameOf = (id: string) => registry.find((m) => m.id === id)?.name ?? id;
const when = (at: number) => new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function MasterHub() {
  const [error, setError] = useState<string | null>(null);
  const hub = useHub((e) => setError(errorText(e)));
  const now = Date.now(), rows = groupMissed(hub.counts, hub.prefs, now), q = hub.prefs.quiet;
  const jump = (id: string) => {
    const m = registry.find((x) => x.id === id);
    if (m) openPanel(m).catch((e) => setError(errorText(e)));
  };
  return (
    <div className="mh">
      {error && <ErrorLine message={error} onDismiss={() => setError(null)} />}
      <header className="mh-head">
        <div><strong>{totalOf(Object.fromEntries(rows.map((r) => [r.id, r.count])))}</strong> missed in {rows.length} module{rows.length === 1 ? "" : "s"}</div>
        <button className="mh-btn" disabled={rows.length === 0} onClick={hub.markAll}>Mark all read</button>
      </header>
      {q.on && <p className="mh-note ui-meta">Quiet hours {fmtHM(q.start)}-{fmtHM(q.end)}{inQuiet(q, minutesOfDay(new Date())) ? " (active: moons are muted)" : ""}</p>}
      {hub.ready && rows.length === 0 && <EmptyState title="All caught up" hint="No missed notifications." />}
      <ul className="mh-list">
        {rows.map((r) => (
          <li key={r.id} className={`mh-item${r.mute ? " muted" : ""}`} style={{ "--dot": registry.find((m) => m.id === r.id)?.accent ?? "var(--accent)" } as React.CSSProperties}>
            <i className="mh-dot" />
            <span className="mh-name">{nameOf(r.id)}</span>
            {r.mute && <span className="mh-tag">{r.mute === "dnd" ? "DND" : "snoozed"}</span>}
            <span className="mh-count">{r.count}</span>
            <span className="mh-acts">
              <button className="mh-btn" onClick={() => jump(r.id)}>Open</button>
              {r.mute === "snooze" ? <button className="mh-btn" onClick={() => hub.unsnooze(r.id)}>Unsnooze</button> : (
                <>
                  <button className="mh-btn" onClick={() => hub.snooze(r.id, "1h")}>1h</button>
                  <button className="mh-btn" onClick={() => hub.snooze(r.id, "tomorrow")}>Tomorrow</button>
                </>
              )}
              <button className={`mh-btn${r.mute === "dnd" ? " on" : ""}`} aria-pressed={r.mute === "dnd"} onClick={() => hub.toggleDnd(r.id)}>DND</button>
            </span>
          </li>
        ))}
      </ul>
      <h3 className="mh-sub">History</h3>
      <Table
        columns={[{ key: "at", label: "When", width: "12em" }, { key: "name", label: "Module" }, { key: "count", label: "Count", width: "5em" }]}
        rows={hub.log.map((l) => ({ id: l.id, at: when(l.at), name: nameOf(l.module_id), count: l.count }))}
        empty="No notifications logged yet."
      />
    </div>
  );
}
