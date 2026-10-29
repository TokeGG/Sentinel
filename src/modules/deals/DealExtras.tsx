// Deals toolbar extras: wishlist (drop alerts = moon count) and the coupon list (collected + your own).
import { useEffect, useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleRow, ModuleState } from "../../ui/useModule";
import { listCoupons, listWishes, type Coupon } from "./extraStore";
import type { Wish } from "./extras";

export function DealExtras({ run, busy, version }: { run: ModuleState["run"]; busy: boolean; version: ModuleRow[] }) {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [term, setTerm] = useState("");
  const [max, setMax] = useState("");
  const [code, setCode] = useState("");
  const [store, setStore] = useState("");
  useEffect(() => {
    void listWishes().then(setWishes).catch(() => {});
    void listCoupons().then(setCoupons).catch(() => {});
  }, [version]);
  const wished = version.filter((r) => r.wished).length;
  return (
    <div className="dl-extras">
      <details>
        <summary className="ui-meta">Wishlist ({wishes.length}){wished ? ` · ${wished} match(es)` : ""}</summary>
        <div className="ui-controls">
          <input className="ui-file-text" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Wish, e.g. rtx 4070" aria-label="Wish term" />
          <input className="ui-file-text dl-num" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Max $" inputMode="decimal" aria-label="Max price" />
          <button type="button" className="ui-btn ui-sm" disabled={busy || !term.trim()} onClick={() => void run("add_wish", { term, max_price: max }).then(() => { setTerm(""); setMax(""); })}>Add</button>
          {wished > 0 && <button type="button" className="ui-btn ui-sm" disabled={busy} onClick={() => void run("mark_wishes_seen")}>Mark seen</button>}
        </div>
        {wishes.map((w) => (
          <div key={w.id} className="dl-src">
            <span>{w.term}{w.max_price !== null ? ` ≤ $${w.max_price}` : ""}</span>
            <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void run("remove_wish", { id: w.id })} />
          </div>
        ))}
      </details>
      <details>
        <summary className="ui-meta">Coupons ({coupons.length})</summary>
        <div className="ui-controls">
          <input className="ui-file-text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CODE" aria-label="Coupon code" />
          <input className="ui-file-text" value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store" aria-label="Store" />
          <button type="button" className="ui-btn ui-sm" disabled={busy || !code.trim()} onClick={() => void run("add_coupon", { code, store }).then(() => { setCode(""); setStore(""); })}>Add</button>
        </div>
        {coupons.map((c) => (
          <div key={`${c.code}|${c.store}`} className="dl-src" title={c.note}>
            <span><b className="dl-code">{c.code}</b> {c.store}{c.expires ? ` · until ${c.expires}` : ""}</span>
            <span className="dl-acts">
              <button type="button" className="ui-btn ui-sm" onClick={() => void navigator.clipboard?.writeText(c.code)}>Copy</button>
              <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void run("remove_coupon", { code: c.code, store: c.store })} />
            </span>
          </div>
        ))}
        <p className="ui-meta">Codes are collected from deal titles/descriptions when sources are checked; unverified, they may be expired.</p>
      </details>
    </div>
  );
}
