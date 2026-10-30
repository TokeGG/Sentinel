// Plan parts: subscription tracker, "can I afford it", savings goals, dividend reminders.
import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { canAfford, goalProgress, monthlyTotal, upcomingDividends } from "./planLogic";
import { fmtMoney } from "./prefs";
import type { PlanProps } from "./Plan";

const today = () => new Date().toISOString().slice(0, 10);

export function SubsPart({ s, prefs, busy, act }: PlanProps) {
  return (
    <div className="fin-part">
      <p className="fin-money"><b>{fmtMoney(monthlyTotal(s.recurring))}</b> / month across {s.recurring.length} recurring charge(s)</p>
      {s.recurring.map((r) => (
        <div key={r.key} className="fin-line">
          <b>{r.name}</b> <span className="fin-money">{fmtMoney(r.amount)}</span> · {r.cycle} · next {r.next} <small className="ui-meta">{r.from}</small>
        </div>
      ))}
      <div className="ui-controls">
        <button type="button" className="ui-btn ui-sm" disabled={busy} onClick={() => void act("renewal_reminders")}>Add renewal reminders (next {prefs.remindDays} days)</button>
      </div>
      <p className="ui-meta">Subscriptions are added in Calendar &gt; Money; recurring bills come from the Bills tab. Reminders become Calendar tasks, once per renewal.</p>
    </div>
  );
}

export function AffordPart({ s, prefs }: PlanProps) {
  const [price, setPrice] = useState("");
  const [cat, setCat] = useState(prefs.categories[0] ?? "");
  const r = price ? canAfford(Number(price), cat, s.budgets, s.spent) : null;
  return (
    <div className="fin-part">
      <div className="ui-controls">
        <input className="ui-file-text fin-num" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" inputMode="decimal" aria-label="Price" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">{prefs.categories.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {r && (
        <p className={`fin-line ${r.ok ? "" : "fired"}`}>
          <b>{r.ok ? "Yes" : "Not this month"}</b> · left {fmtMoney(r.left)} · after {fmtMoney(r.after)} · {r.reason}
        </p>
      )}
    </div>
  );
}

export function GoalsPart({ s, busy, act }: PlanProps) {
  const [f, setF] = useState({ name: "", target: "", by: "" });
  const [dep, setDep] = useState<Record<string, string>>({});
  return (
    <div className="fin-part">
      {s.plan.goals.map((g) => {
        const p = goalProgress(g, new Date());
        return (
          <div key={g.id} className="fin-line">
            <b>{g.name}</b> <span className="fin-money">{fmtMoney(g.saved)} / {fmtMoney(g.target)}</span>
            <span className="fin-bar"><span style={{ width: `${p.pct}%` }} /></span>
            {p.perMonth !== null && <small className="ui-meta">{fmtMoney(p.perMonth)}/mo to {g.by}</small>}
            <input className="ui-file-text fin-num" value={dep[g.id] ?? ""} onChange={(e) => setDep({ ...dep, [g.id]: e.target.value })} placeholder="+/-" inputMode="decimal" aria-label="Deposit" />
            <button type="button" className="ui-btn ui-sm" disabled={busy || !dep[g.id]} onClick={() => void act("goal_deposit", { id: g.id, amount: dep[g.id] }).then(() => setDep({ ...dep, [g.id]: "" }))}>Add</button>
            <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void act("remove_goal", { id: g.id })} />
          </div>
        );
      })}
      <div className="ui-controls">
        <input className="ui-file-text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Goal" aria-label="Goal name" />
        <input className="ui-file-text fin-num" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="Target" inputMode="decimal" aria-label="Target" />
        <input type="date" value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} aria-label="Target date" />
        <button type="button" className="ui-btn ui-sm" disabled={busy || !f.name || !f.target} onClick={() => void act("add_goal", f).then(() => setF({ name: "", target: "", by: "" }))}>Add goal</button>
      </div>
    </div>
  );
}

export function DividendsPart({ s, busy, act }: PlanProps) {
  const [f, setF] = useState({ symbol: "", pay_on: today(), amount: "" });
  return (
    <div className="fin-part">
      {upcomingDividends(s.plan.dividends, new Date()).map((d) => (
        <div key={d.id} className="fin-line">
          <b>{d.symbol}</b> pays {d.pay_on} {d.amount ? <span className="fin-money">{fmtMoney(d.amount)}</span> : null}
          <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void act("remove_dividend", { id: d.id })} />
        </div>
      ))}
      <div className="ui-controls">
        <input className="ui-file-text" value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })} placeholder="Symbol" aria-label="Symbol" />
        <input type="date" value={f.pay_on} onChange={(e) => setF({ ...f, pay_on: e.target.value })} aria-label="Pay date" />
        <input className="ui-file-text fin-num" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="Amount" inputMode="decimal" aria-label="Amount" />
        <button type="button" className="ui-btn ui-sm" disabled={busy || !f.symbol} onClick={() => void act("add_dividend", f).then(() => setF({ ...f, symbol: "", amount: "" }))}>Add</button>
      </div>
      <p className="ui-meta">Dates are entered by you (no data feed); each one is also added as a Calendar task.</p>
    </div>
  );
}
