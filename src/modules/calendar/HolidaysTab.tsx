// Holiday sets on/off, country sets (Nager.Date, cached per year), and editable gaming/approx dates.
import { useEffect, useState } from "react";
import { HOLIDAY_SETS, holidaysFor, holidayTitle } from "./holidays";
import { validCountry } from "./nager";
import { loadPrefs, refreshHolidays, savePrefs, type HolidayPrefs } from "./sourcesStore";

export function HolidaysTab({ onChange }: { onChange(): void }) {
  const [p, setP] = useState<HolidayPrefs | null>(null);
  const [cc, setCc] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => void loadPrefs().then(setP).catch((e) => setMsg(String(e))), []);
  if (!p) return <span className="ui-meta">{msg || "Loading…"}</span>;
  const save = async (n: HolidayPrefs) => { setP(n); await savePrefs(n); onChange(); };
  const fetchNow = async () => {
    setMsg("Fetching…");
    try { setMsg(`Cached ${(await refreshHolidays()).count} country holidays.`); onChange(); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };
  const y = new Date().getFullYear();
  const editable = holidaysFor(y, ["gaming", "prime"], {}).filter((h) => !h.key.endsWith("-obs"));
  return (
    <div className="cal-hol">
      <h3 className="cal-day">Holiday sets</h3>
      {HOLIDAY_SETS.map((s) => (
        <label key={s.id} className="ui-check"><input type="checkbox" checked={p.sets[s.id] ?? s.on} onChange={(e) => void save({ ...p, sets: { ...p.sets, [s.id]: e.target.checked } })} /> {s.label}</label>
      ))}
      <h3 className="cal-day">Countries (Nager.Date, fetched on button or Auto-refresh)</h3>
      <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); const c = cc.trim().toUpperCase(); if (validCountry(c) && !p.countries.includes(c)) void save({ ...p, countries: [...p.countries, c] }).then(fetchNow); setCc(""); }}>
        <input className="ui-input" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Country code, e.g. GB" aria-label="Country code" maxLength={2} />
        <button type="submit" className="ui-btn">Add country</button>
        <button type="button" className="ui-btn" onClick={() => void fetchNow()} disabled={!p.countries.length}>Fetch now</button>
      </form>
      {p.countries.map((c) => <span key={c} className="cal-src">{c} <button type="button" className="ui-btn ui-sm" aria-label={`Remove ${c}`} onClick={() => void save({ ...p, countries: p.countries.filter((x) => x !== c) })}>×</button></span>)}
      <h3 className="cal-day">Gaming / shopping dates {y} (approx unless you set them)</h3>
      <ul className="cal-list">{editable.map((h) => (
        <li key={h.key} className="cal-item hol">
          <span className="cal-text">{holidayTitle(h)}</span>
          <input type="date" className="ui-input" value={p.edits[h.key] || h.day} aria-label={`Date of ${h.title}`} onChange={(e) => void save({ ...p, edits: { ...p.edits, [h.key]: e.target.value } })} />
          <button type="button" className="ui-btn ui-sm" onClick={() => { const edits = { ...p.edits }; if (h.key in edits) delete edits[h.key]; else edits[h.key] = ""; void save({ ...p, edits }); }}>{h.key in p.edits ? "Reset" : "Hide"}</button>
        </li>))}</ul>
      {msg && <span className="ui-meta" role="status">{msg}</span>}
    </div>
  );
}
