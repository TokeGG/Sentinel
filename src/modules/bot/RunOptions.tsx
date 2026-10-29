import { useState } from "react";
import { fillTemplate, GOAL_TEMPLATES } from "./templates";

export interface RunFlags { pre: boolean; dry: boolean; step: boolean }

/** Goal templates + the run mode switches (pre-approve, dry run, step approval). */
export function RunOptions({ flags, set, disabled, onGoal }: { flags: RunFlags; set(f: RunFlags): void; disabled: boolean; onGoal(g: string): void }) {
  const [tpl, setTpl] = useState("");
  const [val, setVal] = useState("");
  const t = GOAL_TEMPLATES.find((g) => g.id === tpl);
  const box = (k: keyof RunFlags, label: string, title: string) => (
    <label className="schedule-toggle" title={title}><input type="checkbox" checked={flags[k]} disabled={disabled} onChange={(e) => set({ ...flags, [k]: e.target.checked })} /> {label}</label>
  );
  return (
    <>
      <div className="ui-quickadd">
        <select className="ui-select" value={tpl} onChange={(e) => setTpl(e.target.value)} disabled={disabled} aria-label="Goal template">
          <option value="">Template...</option>
          {GOAL_TEMPLATES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        {t && <input value={val} onChange={(e) => setVal(e.target.value)} placeholder={t.blank} aria-label={t.blank} disabled={disabled} />}
        {t && <button type="button" className="ui-btn" disabled={disabled || !val.trim()} onClick={() => { const g = fillTemplate(tpl, val); if (g) onGoal(g); }}>Use</button>}
      </div>
      <div className="ui-controls">
        {box("dry", "Dry run (plan only)", "Shows the plan and the first step it would take; nothing is done in the page")}
        {box("step", "Approve each step", "The bot asks before every action and shows why it wants it")}
        {box("pre", "Pre-approve irreversible actions", "Off: the bot asks before submit, purchase, delete and login actions")}
      </div>
    </>
  );
}
