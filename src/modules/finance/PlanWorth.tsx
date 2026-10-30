// Plan parts: net worth chart (SVG, tokens), monthly report (copyable), portfolio CSV import (preview) / export.
import { useState } from "react";
import { parseCsv, type CsvPreview } from "./csv";
import { monthlyTotal } from "./planLogic";
import { fmtMoney } from "./prefs";
import { chartPoints, monthChange, monthlyReport } from "./report";
import { exportCsv } from "./portfolioIO";
import type { PlanProps } from "./Plan";

const W = 320, H = 100;

export function WorthPart({ s, busy, act }: PlanProps) {
  const w = s.plan.worth;
  const pts = chartPoints(w, W, H);
  const lastV = w[w.length - 1]?.value;
  return (
    <div className="fin-part">
      <p className="fin-money">{lastV !== undefined ? <b>{fmtMoney(lastV)}</b> : "No snapshot yet"} {w.length > 0 && <small className="ui-meta">{w.length} day(s), since {w[0].day}</small>}</p>
      {pts ? (
        <svg className="fin-chart fin-money" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net worth over time">
          <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : <p className="ui-meta">The chart appears after two days of snapshots.</p>}
      <div className="ui-controls">
        <button type="button" className="ui-btn ui-sm" disabled={busy} onClick={() => void act("snapshot_worth")}>Snapshot now</button>
      </div>
      <p className="ui-meta">Holdings (Portfolio lots at the latest prices) + cash/other (Settings) + goal savings. A snapshot is also taken after each quote refresh (one per day).</p>
    </div>
  );
}

export function ReportPart({ s }: PlanProps) {
  const month = new Date().toISOString().slice(0, 7);
  const text = monthlyReport(month, s.spent, s.budgets, monthChange(s.plan.worth, month), monthlyTotal(s.recurring), (n) => fmtMoney(n));
  return (
    <div className="fin-part">
      <pre className="fin-report">{text}</pre>
      <button type="button" className="ui-btn ui-sm" onClick={() => void navigator.clipboard?.writeText(text)}>Copy</button>
    </div>
  );
}

export function CsvPart({ busy, act }: PlanProps) {
  const [text, setText] = useState("");
  const [prev, setPrev] = useState<CsvPreview | null>(null);
  const [out, setOut] = useState("");
  return (
    <div className="fin-part">
      <div className="ui-controls">
        <button type="button" className="ui-btn ui-sm" onClick={() => void exportCsv().then(setOut)}>Export CSV</button>
        {out && <button type="button" className="ui-btn ui-sm" onClick={() => void navigator.clipboard?.writeText(out)}>Copy</button>}
        {out && <a className="ui-btn ui-sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent(out)}`} download="portfolio.csv">Save file</a>}
      </div>
      {out && <pre className="fin-report">{out}</pre>}
      <textarea className="fin-csv" value={text} onChange={(e) => { setText(e.target.value); setPrev(null); }} placeholder="symbol,kind,qty,cost,bought_on" aria-label="CSV to import" />
      <div className="ui-controls">
        <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => void e.target.files?.[0]?.text().then((t) => { setText(t); setPrev(null); })} />
        <button type="button" className="ui-btn ui-sm" disabled={!text.trim()} onClick={() => setPrev(parseCsv(text))}>Preview</button>
      </div>
      {prev && (
        <div>
          {prev.rows.map((r, i) => <div key={i} className="fin-line">{r.symbol.toUpperCase()} ({r.kind}) {r.qty} @ {fmtMoney(r.cost)} {r.bought_on}</div>)}
          {prev.errors.map((e) => <p key={e} className="ui-meta">Skipped {e}</p>)}
          <button type="button" className="ui-btn ui-sm primary" disabled={busy || !prev.rows.length} onClick={() => void act("import_lots", { csv: text }).then(() => { setText(""); setPrev(null); })}>Import {prev.rows.length} lot(s)</button>
        </div>
      )}
    </div>
  );
}
