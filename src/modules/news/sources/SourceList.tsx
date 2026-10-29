// Generic curated-source list (News, Deals): category/status filter, enable/disable, remove, Check sources.
// Every seeded source starts "unverified" until Check sources fetches it.
import { useEffect, useState } from "react";
import { ConfirmButton } from "../../../ui/ConfirmButton";
import { Chip } from "../../../ui/kit";
import { countBy, filterRows, type SrcRow, type SrcStatus } from "./logic";

export interface SourceApi {
  list(): Promise<SrcRow[]>;
  setEnabled(r: SrcRow, on: boolean): Promise<unknown>;
  remove(r: SrcRow): Promise<unknown>;
  check(urls: string[]): Promise<unknown>;
}

const STATUSES: SrcStatus[] = ["unverified", "working", "broken"];

export function SourceList({ api, categories, busy, version }: { api: SourceApi; categories: { id: string; label: string }[]; busy: boolean; version?: unknown }) {
  const [rows, setRows] = useState<SrcRow[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [st, setSt] = useState<SrcStatus | null>(null);
  const [work, setWork] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reload = () => api.list().then(setRows, (e) => setErr(String(e)));
  useEffect(() => void reload(), [api, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (label: string, fn: () => Promise<unknown>) => {
    setWork(label);
    setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    await reload();
    setWork(null);
  };
  const shown = filterRows(rows, cat, st);
  const off = busy || work !== null;
  return (
    <div className="src-list">
      <div className="ui-controls">
        <button type="button" className="ui-btn primary" disabled={off || !shown.length} onClick={() => void act("Checking…", () => api.check(shown.map((r) => r.url)))}>
          {work ?? `Check sources (${shown.length})`}
        </button>
        <span className="ui-meta">{countBy(rows, "working")} working · {countBy(rows, "broken")} broken · {countBy(rows, "unverified")} unverified</span>
      </div>
      {err && <p className="ui-meta" role="alert">{err}</p>}
      <div className="ui-chips">
        <Chip on={cat === null} onClick={() => setCat(null)}>All ({rows.length})</Chip>
        {categories.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.label} ({rows.filter((r) => r.category === c.id).length})</Chip>)}
      </div>
      <div className="ui-chips">
        {STATUSES.map((s) => <Chip key={s} on={st === s} onClick={() => setSt(st === s ? null : s)}>{s}</Chip>)}
      </div>
      {shown.map((r) => (
        <div key={r.id} className={`src-row src-${r.status}`}>
          <label title={r.url}>
            <input type="checkbox" checked={r.enabled} disabled={off} onChange={(e) => void act("Saving…", () => api.setEnabled(r, e.target.checked))} />
            {" "}{r.label || r.url}
          </label>
          <span className="src-status" title={r.err || r.url}>{r.status}{r.err ? `: ${r.err}` : ""}</span>
          <ConfirmButton label="Remove" disabled={off} title="Removes the source and its items; it is not re-added later" onConfirm={() => void act("Removing…", () => api.remove(r))} />
        </div>
      ))}
    </div>
  );
}
