// Expenses and subscriptions: log spending, track renewals, monthly totals by category.
import { calendarLimits } from "./panelLogic";
import { useLimit } from "../../ui/useOption";
import { useState } from "react";
import { ErrorLine, Row } from "../../ui/kit";
import { useStore } from "../../ui/useStore";
import { addExpense, addSub, deleteExpense, deleteSub, listExpenses, listSubs } from "./extraStore";
import { byCategory, CYCLES, monthlyCost, nextRenewal, round2, validAmount } from "./money";
import { dayKey } from "./panelLogic";

export function MoneyTab() {
  const moneyRows = useLimit(calendarLimits, "moneyRows");
  const subs = useStore(listSubs, []);
  const ex = useStore(listExpenses, []);
  const today = dayKey(new Date())!;
  const [f, setF] = useState({ name: "", amount: "", cycle: "monthly", day: today, category: "general" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const month = today.slice(0, 7);
  const perMonth = round2(subs.data.reduce((s, x) => s + monthlyCost(x), 0));
  return (
    <div className="cal-form">
      <form className="cal-fields" onSubmit={(e) => e.preventDefault()}>
        <input placeholder="Name / note" value={f.name} onChange={set("name")} />
        <input placeholder="Amount" inputMode="decimal" value={f.amount} onChange={set("amount")} />
        <input placeholder="Category" value={f.category} onChange={set("category")} />
        <input type="date" value={f.day} onChange={set("day")} />
        <select value={f.cycle} onChange={set("cycle")}>{CYCLES.map((c) => <option key={c}>{c}</option>)}</select>
        <button type="button" className="ui-btn" onClick={() => void ex.act(async () => { await addExpense({ day: f.day, amount: validAmount(f.amount), category: f.category.trim() || "general", note: f.name.trim() }); setF({ ...f, amount: "", name: "" }); })}>Log expense</button>
        <button type="button" className="ui-btn" onClick={() => void subs.act(async () => { if (!f.name.trim()) throw new Error("Name the subscription"); await addSub({ name: f.name.trim(), amount: validAmount(f.amount), cycle: f.cycle, renew_on: f.day, category: f.category.trim() || "general" }); setF({ ...f, amount: "", name: "" }); })}>Add subscription</button>
      </form>
      {(subs.error || ex.error) && <ErrorLine message={(subs.error || ex.error)!} />}
      <h3 className="cal-day">Subscriptions · {perMonth}/month</h3>
      {subs.data.map((s) => (
        <Row key={s.id} end={<><span className="ui-meta">renews {nextRenewal(s.renew_on, s.cycle, new Date())}</span><button type="button" className="ui-btn ui-sm" onClick={() => void subs.act(() => deleteSub(s.id))}>Remove</button></>}>
          <strong>{s.name}</strong> <span className="ui-meta">{s.amount} {s.cycle} · {s.category}</span>
        </Row>
      ))}
      <h3 className="cal-day">This month by category</h3>
      {byCategory(ex.data, month).map(([c, n]) => <span key={c} className="ui-meta">{c}: {n}</span>)}
      <h3 className="cal-day">Recent expenses</h3>
      {ex.data.slice(0, moneyRows).map((x) => (
        <Row key={x.id} end={<button type="button" className="ui-btn ui-sm" onClick={() => void ex.act(() => deleteExpense(x.id))}>Remove</button>}>
          {x.day} · {x.amount} · {x.category} <span className="ui-meta">{x.note}</span>
        </Row>
      ))}
    </div>
  );
}
