// Focus / pomodoro: writes app_settings focus_until; the countdown runs only while the panel is open.
import { useEffect, useState } from "react";
import { getSetting, setSetting } from "../../ui/appSetting";
import { useStore } from "../../ui/useStore";
import { listFocus, logFocus } from "./extraStore";
import { clock, FOCUS_KEY, focusUntil, minutesOn, PRESETS, secondsLeft } from "./focus";
import { dayKey } from "./panelLogic";
import { localStamp } from "./reminders";
import { FocusStats } from "./FocusStats";

export function FocusTab() {
  const until = useStore(() => getSetting(FOCUS_KEY), null);
  const log = useStore(listFocus, []);
  const [now, setNow] = useState(() => new Date());
  const [label, setLabel] = useState("");
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const left = secondsLeft(until.data, now);
  const start = (m: number) => void until.act(async () => {
    await setSetting(FOCUS_KEY, focusUntil(new Date(), m));
    await logFocus(localStamp(new Date()), m, label.trim());
    await log.reload();
  });
  return (
    <div className="cal-focus">
      <div className="cal-clock" aria-live="polite">{left ? clock(left) : "Ready"}</div>
      <input placeholder="What are you focusing on? (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="ui-controls">
        {PRESETS.map((p) => <button key={p.label} type="button" className="ui-btn" disabled={until.busy} onClick={() => start(p.minutes)}>{p.label}</button>)}
        {left > 0 && <button type="button" className="ui-btn" onClick={() => void until.act(() => setSetting(FOCUS_KEY, ""))}>Stop</button>}
      </div>
      <p className="ui-meta">Focused today: {minutesOn(log.data, dayKey(now)!)} min · {log.data.length} sessions logged.</p>
      <FocusStats log={log.data} />
    </div>
  );
}
