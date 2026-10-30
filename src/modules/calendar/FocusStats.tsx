// Focus tab extras: pomodoro stats chart (last 7 days, top labels) + opt-in per-panel time tracking totals.
import { getSetting, setSetting } from "../../ui/appSetting";
import { useStore } from "../../ui/useStore";
import { registry } from "../../core/module";
import { fmtDur, TIME_TRACK_KEY, totals } from "../../shell/timeTrack";
import { listPanelTime } from "../../shell/useTimeTrack";
import { byLabel, lastDays, type Session } from "./pomoStats";

export function FocusStats({ log }: { log: Session[] }) {
  const on = useStore(() => getSetting(TIME_TRACK_KEY), null);
  const time = useStore(listPanelTime, []);
  const days = lastDays(log, new Date());
  const max = Math.max(25, ...days.map((d) => d.minutes));
  const since = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const name = (id: string) => registry.find((m) => m.id === id)?.name ?? id;
  return (
    <div className="cal-stats">
      <h4>Focus, last 7 days</h4>
      <svg viewBox="0 0 140 60" width="100%" role="img" aria-label={days.map((d) => `${d.day} ${d.minutes} min`).join(", ")}>
        {days.map((d, i) => { const h = (d.minutes / max) * 44; return <g key={d.day}>
          <rect x={i * 20 + 2} y={48 - h} width="14" height={h} rx="1" fill="var(--accent)" />
          <text x={i * 20 + 9} y="57" fontSize="6" textAnchor="middle" fill="currentColor">{d.day.slice(8)}</text></g>; })}
      </svg>
      {byLabel(log).map((l) => <div key={l.label} className="ui-meta">{l.label}: {l.minutes} min</div>)}
      <h4>Time per panel</h4>
      <label className="ui-meta"><input type="checkbox" checked={on.data === "1"} onChange={(e) => void on.act(() => setSetting(TIME_TRACK_KEY, e.target.checked ? "1" : "0"))} /> Track time spent in each panel (this PC only; applies to panels opened after this)</label>
      {totals(time.data, since).map((t) => <div key={t.panel} className="ui-meta">{name(t.panel)}: {fmtDur(t.secs)} this week</div>)}
    </div>
  );
}
