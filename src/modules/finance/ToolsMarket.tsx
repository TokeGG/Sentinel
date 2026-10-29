// Portfolio lots (gain/loss per symbol) and price alerts.
import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { EmptyState } from "../../ui/kit";
import { fmtPrice, pctText } from "./panelLogic";
import { lotSummary } from "./money";
import type { PartProps } from "./Tools";

const sym = (w: Record<string, unknown>) => String(w.symbol).toUpperCase();

function SymbolPick({ watch, value, onChange }: { watch: PartProps["watch"]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Symbol">
      <option value="">Symbol…</option>
      {watch.map((w) => <option key={String(w.dbId)} value={String(w.dbId)}>{sym(w)}</option>)}
    </select>
  );
}

export function LotsPart({ data, watch, busy, act }: PartProps) {
  const [id, setId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const rows = watch.map((w) => ({ w, lots: data.lots.filter((l) => l.watch_id === w.dbId) })).filter((x) => x.lots.length);
  const total = rows.reduce((s, x) => { const t = lotSummary(x.lots, x.w.price as number | null); return { cost: s.cost + t.cost, value: s.value + (t.value ?? t.cost) }; }, { cost: 0, value: 0 });
  return (
    <div className="fin-part">
      {rows.length ? rows.map(({ w, lots }) => {
        const t = lotSummary(lots, typeof w.price === "number" ? w.price : null);
        const tone = t.gain === null || t.gain === 0 ? "flat" : t.gain > 0 ? "up" : "down";
        return (
          <details key={String(w.dbId)} className="fin-lot">
            <summary><b>{sym(w)}</b> {t.qty} @ {fmtPrice(t.cost / (t.qty || 1))} → {fmtPrice(t.value)} <span className={`fin-pill ${tone}`}>{t.gain === null ? "no price" : `${fmtPrice(t.gain)} (${pctText(t.pct)})`}</span></summary>
            {lots.map((l) => (
              <div key={l.id} className="fin-line">{l.qty} @ {fmtPrice(l.cost)} {l.bought_on}
                <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void act("remove_lot", { id: l.id })} />
              </div>
            ))}
          </details>
        );
      }) : <EmptyState title="No lots yet" hint="Add a buy below (quantity and price per unit)." />}
      {rows.length > 0 && <p className="ui-meta">Total cost {fmtPrice(total.cost)} · value {fmtPrice(total.value)}</p>}
      <div className="ui-controls">
        <SymbolPick watch={watch} value={id} onChange={setId} />
        <input className="ui-file-text fin-num" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" inputMode="decimal" aria-label="Quantity" />
        <input className="ui-file-text fin-num" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Price each" inputMode="decimal" aria-label="Price each" />
        <button type="button" className="ui-btn ui-sm" disabled={busy || !id || !qty || !cost} onClick={() => void act("add_lot", { id: Number(id), qty, cost, bought_on: new Date().toISOString().slice(0, 10) }).then(() => { setQty(""); setCost(""); })}>Add lot</button>
      </div>
    </div>
  );
}

export function AlertsPart({ data, watch, busy, act }: PartProps) {
  const [id, setId] = useState("");
  const [dir, setDir] = useState("above");
  const [price, setPrice] = useState("");
  const name = (wid: number) => { const w = watch.find((x) => x.dbId === wid); return w ? sym(w) : `#${wid}`; };
  const unseen = data.alerts.filter((a) => a.fired && !a.seen).length;
  return (
    <div className="fin-part">
      {data.alerts.map((a) => (
        <div key={a.id} className={`fin-line ${a.fired ? "fired" : ""}`}>
          {name(a.watch_id)} {a.dir} {fmtPrice(a.price)} {a.fired ? "· triggered" : "· waiting"}
          <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void act("remove_alert", { id: a.id })} />
        </div>
      ))}
      {unseen > 0 && <button type="button" className="ui-btn ui-sm" disabled={busy} onClick={() => void act("mark_alerts_seen")}>Mark {unseen} seen</button>}
      <div className="ui-controls">
        <SymbolPick watch={watch} value={id} onChange={setId} />
        <select value={dir} onChange={(e) => setDir(e.target.value)} aria-label="Direction"><option value="above">above</option><option value="below">below</option></select>
        <input className="ui-file-text fin-num" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" inputMode="decimal" aria-label="Alert price" />
        <button type="button" className="ui-btn ui-sm" disabled={busy || !id || !price} onClick={() => void act("add_alert", { id: Number(id), dir, price }).then(() => setPrice(""))}>Add alert</button>
      </div>
      <p className="ui-meta">Checked after each quote refresh (button or opt-in auto-refresh). Fired alerts show as a moon count.</p>
    </div>
  );
}
