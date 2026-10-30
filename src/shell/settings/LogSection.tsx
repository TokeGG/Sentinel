// Settings > Activity log: Sentinel's own log (read-only viewer) + diagnostic report export (preview, then a file the user picks).
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { getDb, getDbDiagnostics } from "../../core/db";
import { Row } from "../../ui/kit";
import { Head } from "./Switch";
import { buildReport, filterLog, logModules, type LogRow } from "../privacy/history";
import { loadSys } from "../privacy/sysPrefsStore";

async function readLog(): Promise<LogRow[]> {
  return (await getDb()).select<LogRow[]>("SELECT * FROM activity_log ORDER BY id DESC LIMIT 500");
}

async function makeReport(log: LogRow[]): Promise<string> {
  const diag = await getDbDiagnostics();
  return buildReport({
    version: await getVersion().catch(() => "unknown"), userAgent: navigator.userAgent, at: new Date().toISOString(),
    tables: diag.tables, migrations: diag.migrations.filter((m) => m.success).map((m) => m.version),
    loadProblem: diag.loadProblem, log, prefs: { ...(await loadSys()) },
  });
}

export function LogSection({ onError }: { onError(e: unknown): void }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const load = () => readLog().then(setRows).catch(onError);
  useEffect(() => { void load(); }, []);
  const write = async () => {
    try {
      const path = await save({ defaultPath: "sentinel-diagnostics.txt", filters: [{ name: "Text", extensions: ["txt"] }] });
      if (!path) return;
      await invoke("write_text_file", { path, contents: report });
      setReport(null); setMsg("Report saved");
    } catch (e) { onError(e); }
  };
  const shown = filterLog(rows, q, mod);
  return (
    <section className="st-section" aria-label="Activity log">
      <Head>Activity log</Head>
      <Row>
        <input className="ui-input" placeholder="Filter" aria-label="Filter log" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="ui-input" aria-label="Module" value={mod} onChange={(e) => setMod(e.target.value)}>
          <option value="">All modules</option>
          {logModules(rows).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button className="ui-btn ui-sm" onClick={() => void load()}>Reload</button>
      </Row>
      <div style={{ maxHeight: 240, overflow: "auto" }}>
        {shown.slice(0, 200).map((r) => (
          <div key={r.id} className="ui-meta">{r.created_at} <b>{r.module}/{r.skill}</b> {r.summary} → {r.result}</div>
        ))}
        {shown.length === 0 && <div className="ui-meta">No entries.</div>}
      </div>
      <Head>Diagnostic report</Head>
      <Row><button className="ui-btn" onClick={() => makeReport(rows).then(setReport).catch(onError)}>Create report…</button>
        {msg && <span className="ui-meta" role="status">{msg}</span>}</Row>
      {report !== null && (
        <div className="ui-banner" role="dialog" aria-label="Report preview">
          <pre style={{ maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap" }}>{report}</pre>
          <button className="ui-btn primary" onClick={() => void write()}>Choose file and save</button>
          <button className="ui-btn" onClick={() => setReport(null)}>Cancel</button>
        </div>
      )}
    </section>
  );
}
