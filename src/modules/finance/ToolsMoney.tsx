// Budgets (spend from Calendar > Money expenses), bills (also added to the calendar agenda), receipt/warranty vault.
import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { BILL_CYCLES, budgetStatus, expiryState, MAX_VAULT_BYTES, upcomingBills } from "./money";
import { fmtPrice } from "./panelLogic";
import { searchVault } from "./report";
import type { PartProps } from "./Tools";

const today = () => new Date().toISOString().slice(0, 10);

export function BudgetsPart({ data, busy, act, prefs }: PartProps) {
  const [cat, setCat] = useState("");
  const [amt, setAmt] = useState("");
  return (
    <div className="fin-part">
      {budgetStatus(data.budgets, data.spent).map((b) => (
        <div key={b.category} className={`fin-line ${b.over ? "fired" : ""}`}>
          <b>{b.category}</b> {fmtPrice(b.spent)} / {fmtPrice(b.monthly)}
          <span className="fin-bar"><span style={{ width: `${b.pct}%` }} /></span>
          <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void act("remove_budget", { category: b.category })} />
        </div>
      ))}
      <div className="ui-controls">
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">Category…</option>{prefs.categories.map((c) => <option key={c}>{c}</option>)}</select>
        <input className="ui-file-text fin-num" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Monthly" inputMode="decimal" aria-label="Monthly target" />
        <button type="button" className="ui-btn ui-sm" disabled={busy || !cat || !amt} onClick={() => void act("set_budget", { category: cat, monthly: amt }).then(() => { setCat(""); setAmt(""); })}>Set</button>
      </div>
      <p className="ui-meta">Spend this month comes from expenses logged in Calendar &gt; Money (same category names). Edit categories in Plan &gt; Settings.</p>
    </div>
  );
}

export function BillsPart({ data, busy, act }: PartProps) {
  const [f, setF] = useState({ name: "", amount: "", due_on: today(), cycle: "monthly" });
  return (
    <div className="fin-part">
      {upcomingBills(data.bills, new Date()).map((b) => (
        <div key={b.id} className={`fin-line ${b.soon ? "fired" : ""}`}>
          <b>{b.name}</b> {fmtPrice(b.amount)} · due {b.next} ({b.cycle})
          <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void act("remove_bill", { id: b.id })} />
        </div>
      ))}
      <div className="ui-controls">
        <input className="ui-file-text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Bill" aria-label="Bill name" />
        <input className="ui-file-text fin-num" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="$" inputMode="decimal" aria-label="Amount" />
        <input type="date" value={f.due_on} onChange={(e) => setF({ ...f, due_on: e.target.value })} aria-label="Due date" />
        <select value={f.cycle} onChange={(e) => setF({ ...f, cycle: e.target.value })} aria-label="Repeats">{BILL_CYCLES.map((c) => <option key={c}>{c}</option>)}</select>
        <button type="button" className="ui-btn ui-sm" disabled={busy || !f.name} onClick={() => void act("add_bill", f).then(() => setF({ ...f, name: "", amount: "" }))}>Add bill</button>
      </div>
      <p className="ui-meta">Each bill is also added as a task on the Calendar agenda (yearly bills once).</p>
    </div>
  );
}

export function VaultPart({ data, busy, act }: PartProps) {
  const [f, setF] = useState({ name: "", expires_on: "", note: "", file_name: "", data_url: "" });
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_VAULT_BYTES) return setErr("File is over 2 MB");
    const rd = new FileReader();
    rd.onload = () => { setErr(""); setF((x) => ({ ...x, file_name: file.name, data_url: String(rd.result) })); };
    rd.readAsDataURL(file);
  };
  return (
    <div className="fin-part">
      <input className="ui-file-text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, date (2026-05) or notes" aria-label="Search vault" />
      {searchVault(data.vault, q).map((v) => {
        const st = expiryState(v.expires_on, new Date());
        return (
          <div key={v.id} className={`fin-line ${st ? "fired" : ""}`}>
            <b>{v.name}</b> {v.expires_on && `· ${st === "expired" ? "expired" : "until"} ${v.expires_on}`} {v.note}
            {v.data_url && <a className="ui-btn ui-sm" href={v.data_url} download={v.file_name || v.name}>Save file</a>}
            <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void act("remove_vault", { id: v.id })} />
          </div>
        );
      })}
      <div className="ui-controls">
        <input className="ui-file-text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Item (receipt / warranty)" aria-label="Item" />
        <input className="ui-file-text" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Notes (store, serial…)" aria-label="Notes" />
        <input type="date" value={f.expires_on} onChange={(e) => setF({ ...f, expires_on: e.target.value })} aria-label="Warranty ends" />
        <input type="file" onChange={(e) => pick(e.target.files?.[0])} aria-label="Attach file" />
        <button type="button" className="ui-btn ui-sm" disabled={busy || !f.name} onClick={() => void act("add_vault", f).then(() => setF({ name: "", expires_on: "", note: "", file_name: "", data_url: "" }))}>Add</button>
      </div>
      {err && <p className="ui-meta">{err}</p>}
      <p className="ui-meta">Files are stored inside the local database (max 2 MB each). Not for secrets.</p>
    </div>
  );
}
