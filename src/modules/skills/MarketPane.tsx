import { useState } from "react";
import { Row } from "../../ui/kit";
import type { ModuleState } from "../../ui/useModule";
import type { Plan } from "./install";
import { filterMarket, installForm, MARKET_NOTE } from "./marketplace";

/** Curated, static suggestions; "Review" builds the normal install plan for the confirm screen. */
export function MarketPane({ busy, run, onPlan }: { busy: boolean; run: ModuleState["run"]; onPlan(p: Plan): void }) {
  const [q, setQ] = useState("");
  const review = async (f: ReturnType<typeof installForm>) => { const p = (await run("plan_install", f)) as Plan | undefined; if (p) onPlan(p); };
  return (
    <div className="sk-form">
      <p className="ui-meta">{MARKET_NOTE}</p>
      <input className="ui-file-text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter suggestions" aria-label="Filter suggestions" />
      {filterMarket(q).map((e) => (
        <Row key={e.id} end={<button type="button" className="ui-btn" disabled={busy} onClick={() => void review(installForm(e))}>Review</button>}>
          <strong>{e.title}</strong> <span className="ui-meta">{e.kind === "mcp" ? "MCP server" : "Skill"} - {e.category} - suggested, verify before install</span>
          <div className="ui-meta">{e.description}</div>
          <div className="ui-meta">{e.input}{e.command ? ` - ${e.command}` : ""}</div>
        </Row>
      ))}
    </div>
  );
}
