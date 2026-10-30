// Import your own: CSV (title,date,time,notes) with preview, and ICS URL subscriptions (refresh on button / opt-in schedule).
import { useEffect, useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { parseCsv } from "./csvImport";
import { listSubs, type Sub } from "./sourcesStore";

type Run = (skill: string, args?: Record<string, unknown>) => Promise<unknown>;

export function ImportsTab({ busy, run }: { busy: boolean; run: Run }) {
  const [csv, setCsv] = useState<ReturnType<typeof parseCsv> | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const reload = () => void listSubs().then(setSubs).catch(() => setSubs([]));
  useEffect(reload, []);
  const go = async (skill: string, args?: Record<string, unknown>) => { const o = (await run(skill, args)) as { added?: number } | undefined; if (o) setMsg(`${skill.replace("_", " ")}: ${o.added ?? 0} added.`); reload(); };
  return (
    <div className="cal-ics">
      <h3 className="cal-day">CSV (title,date,time,notes)</h3>
      <label className="ui-btn">Choose .csv file…<input type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCsv(parseCsv(await f.text())); }} /></label>
      <textarea className="cal-paste" rows={3} aria-label="Paste CSV" placeholder="Dentist,2026-11-02,09:30,bring card" onChange={(e) => setCsv(e.target.value.trim() ? parseCsv(e.target.value) : null)} />
      {csv && (
        <div className="ui-banner" role="alertdialog" aria-label="Confirm CSV import">
          <strong>{csv.rows.length} row(s) ready</strong>{csv.errors.length > 0 && <span className="ui-meta"> · {csv.errors.length} skipped</span>}
          <ul className="cal-prev">{csv.rows.slice(0, 8).map((r, i) => <li key={i}>{r.day} {r.time} — {r.title}</li>)}{csv.errors.slice(0, 4).map((e) => <li key={e} className="ui-meta">{e}</li>)}</ul>
          <div className="ui-controls">
            <button type="button" className="ui-btn primary" disabled={busy || !csv.rows.length} onClick={() => void go("import_csv", { rows: csv.rows }).then(() => setCsv(null))}>Import {csv.rows.length}</button>
            <button type="button" className="ui-btn" onClick={() => setCsv(null)}>Cancel</button>
          </div>
        </div>
      )}
      <h3 className="cal-day">Calendar subscriptions (.ics URL)</h3>
      <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); if (url.trim()) void go("add_sub", { url }).then(() => setUrl("")); }}>
        <input className="ui-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or webcal://…" aria-label="Subscription URL" />
        <button type="submit" className="ui-btn" disabled={busy}>Subscribe</button>
        <button type="button" className="ui-btn" disabled={busy || !subs.length} onClick={() => void go("refresh_sources")}>Refresh now</button>
      </form>
      <ul className="cal-list">{subs.map((s) => (
        <li key={s.id} className="cal-item"><span className="cal-text" title={s.url}>{s.name || s.url}</span>
          <span className="ui-meta">{s.last_fetched ? `${s.last_count} events · ${s.last_fetched}` : "not fetched"}</span>
          <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void go("remove_sub", { id: s.id })} /></li>))}</ul>
      {msg && <span className="ui-meta" role="status">{msg}</span>}
    </div>
  );
}
