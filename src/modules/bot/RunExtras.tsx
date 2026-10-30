import { useState } from "react";
import type { ModuleState } from "../../ui/useModule";
import type { Episode } from "./actions";
import { costLine } from "./runCost";

/** Under a finished run: the cost meter, and thumbs on each skill the run was given (they tune future skill picks). */
export function RunExtras({ ep, run, busy, thumbs, onRated }: { ep: Episode; run: ModuleState["run"]; busy: boolean; thumbs: boolean; onRated(): void }) {
  const [done, setDone] = useState<Record<string, "up" | "down">>({});
  const rate = async (name: string, thumbs: "up" | "down") => { if ((await run("rate_skill", { name, thumbs })) !== undefined) { setDone((d) => ({ ...d, [name]: thumbs })); onRated(); } };
  return (
    <>
      <div className="ui-meta">Cost: {costLine(ep)}</div>
      {thumbs && (ep.skills ?? []).length > 0 && ep.outcome !== "dry" && (
        <div className="ui-actions">
          <span className="ui-meta">Skills used:</span>
          {ep.skills!.map((s) => (
            <span key={s} className="ui-actions">
              <span>{s}</span>
              <button type="button" className="ui-btn" disabled={busy || !!done[s]} aria-label={`Skill ${s} helped`} onClick={() => void rate(s, "up")}>+</button>
              <button type="button" className="ui-btn" disabled={busy || !!done[s]} aria-label={`Skill ${s} did not help`} onClick={() => void rate(s, "down")}>-</button>
              {done[s] && <span className="ui-meta">{done[s] === "up" ? "helped" : "noted"}</span>}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
