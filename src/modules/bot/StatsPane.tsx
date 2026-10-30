import { useLimit } from "../../ui/useOption";
import { botLimits } from "./panelLogic";
import { useState } from "react";
import { Row } from "../../ui/kit";
import { scoreBoost } from "../../core/skillPick";
import { pct, skillStats } from "./skillStats";
import type { More } from "./useMore";

/** Skill usage from the run log: most used, failing (>= the chosen fail rate), never used; with the thumbs score. */
export function StatsPane({ more }: { more: More }) {
  const lim = useLimit(botLimits, "skillRows");
  const [rate, setRate] = useState(0.5);
  const st = skillStats(more.log.map((r) => r.ep), more.skills, 2, rate);
  const score = (n: string) => { const s = more.cfg?.scores[n]; return s ? ` thumbs +${s.up}/-${s.down} (${scoreBoost(s) >= 0 ? "+" : ""}${scoreBoost(s).toFixed(2)})` : ""; };
  return (
    <div className="bot-goal">
      <p className="ui-meta">From the last {more.log.length} runs (dry runs and stopped runs not counted).</p>
      <h4 className="ui-meta">Most used</h4>
      {st.used.length === 0 ? <p className="ui-meta">No run has used a skill yet.</p> : st.used.slice(0, lim).map((s) => (
        <Row key={s.name}><strong>{s.name}</strong> <span className="ui-meta">{s.uses} runs, {pct(s.failRate)} not finished{score(s.name)}</span></Row>
      ))}
      <h4 className="ui-meta">Failing
        <label className="schedule-toggle"> at {pct(rate)}+{" "}
          <input type="range" min={0.2} max={1} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Failing threshold" />
        </label>
      </h4>
      {st.failing.length === 0 ? <p className="ui-meta">None.</p> : st.failing.map((s) => <Row key={s.name}><strong>{s.name}</strong> <span className="ui-meta">{s.fails} of {s.uses} runs did not finish</span></Row>)}
      <h4 className="ui-meta">Never used ({st.never.length})</h4>
      <p className="ui-meta">{st.never.join(", ") || "None."}</p>
    </div>
  );
}
