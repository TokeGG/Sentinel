// Plan settings: currency, number format, privacy blur, refresh intervals, reminder window, cash, spending categories.
import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { CURRENCIES, editCategories, fmtMoney, INTERVALS, LOCALES, type FinPrefs } from "./prefs";
import type { PlanProps } from "./Plan";

const mins = (n: number) => (n < 60 ? `${n} min` : `${n / 60} h`);

export function SettingsPart({ prefs, busy, act }: PlanProps) {
  const set = (patch: Partial<FinPrefs>) => void act("set_prefs", patch);
  const [cat, setCat] = useState("");
  const [cash, setCash] = useState(String(prefs.cash));
  const [ren, setRen] = useState<Record<string, string>>({});
  const cats = (op: "add" | "rename" | "remove", name: string, to = "") => set({ categories: editCategories(prefs.categories, op, name, to) });
  return (
    <div className="fin-part">
      <div className="ui-controls">
        <label>Currency <select value={prefs.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Number format <select value={prefs.locale} onChange={(e) => set({ locale: e.target.value })}>{LOCALES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <span className="ui-meta">e.g. {fmtMoney(1234.5, prefs)}</span>
      </div>
      <div className="ui-controls">
        <label><input type="checkbox" checked={prefs.blur} onChange={(e) => set({ blur: e.target.checked })} /> Privacy blur (portfolio amounts)</label>
      </div>
      <div className="ui-controls">
        <label>Stocks every <select value={prefs.stockMinutes} onChange={(e) => set({ stockMinutes: Number(e.target.value) })}>{INTERVALS.map((n) => <option key={n} value={n}>{mins(n)}</option>)}</select></label>
        <label>Crypto every <select value={prefs.cryptoMinutes} onChange={(e) => set({ cryptoMinutes: Number(e.target.value) })}>{INTERVALS.map((n) => <option key={n} value={n}>{mins(n)}</option>)}</select></label>
      </div>
      <p className="ui-meta">Intervals apply only while the module's Auto-refresh checkbox is on (off by default).</p>
      <div className="ui-controls">
        <label>Renewal reminders <input className="ui-file-text fin-num" type="number" min={1} max={60} value={prefs.remindDays} onChange={(e) => set({ remindDays: Number(e.target.value) })} /> days ahead</label>
        <label>Cash / other assets <input className="ui-file-text fin-num" value={cash} onChange={(e) => setCash(e.target.value)} onBlur={() => Number.isFinite(Number(cash)) && set({ cash: Number(cash) })} inputMode="decimal" /></label>
      </div>
      <h4 className="ui-meta">Spending categories</h4>
      {prefs.categories.map((c) => (
        <div key={c} className="fin-line">
          <input className="ui-file-text" value={ren[c] ?? c} onChange={(e) => setRen({ ...ren, [c]: e.target.value })} onBlur={() => ren[c] && ren[c] !== c && cats("rename", c, ren[c])} aria-label={`Rename ${c}`} />
          <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy || prefs.categories.length < 2} onConfirm={() => cats("remove", c)} />
        </div>
      ))}
      <div className="ui-controls">
        <input className="ui-file-text" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="New category" aria-label="New category" />
        <button type="button" className="ui-btn ui-sm" disabled={busy || !cat.trim()} onClick={() => { cats("add", cat); setCat(""); }}>Add</button>
      </div>
      <p className="ui-meta">Currency changes the display only (no conversion); it also applies to Deals prices.</p>
    </div>
  );
}
