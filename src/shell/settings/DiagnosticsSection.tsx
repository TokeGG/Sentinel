import { useRef, useState } from "react";
import { getDbDiagnostics } from "../../core/db";
import { describeDb, type DbDiagnostics } from "../../core/schema";
import { Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { describeRepair, explainLoadProblem, type RepairReport } from "../../core/dbExplain";

const repair = async (run: boolean): Promise<RepairReport> =>
  (await import("@tauri-apps/api/core")).invoke<RepairReport>("db_repair", { run });
import { Head } from "./Switch";

// Manual only: nothing runs until the user presses "Run check".
export function DiagnosticsSection({ onError }: { onError(e: unknown): void }) {
  const [diag, setDiag] = useState<DbDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rep, setRep] = useState<RepairReport | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const report = diag ? describeDb(diag) : "";

  const run = async () => {
    setBusy(true);
    setCopied(false);
    try {
      setDiag(await getDbDiagnostics());
      setRep(await repair(false).catch(() => null));
    } catch (e) { onError(e); }
    setBusy(false);
  };
  // Rust backs the db file up before changing anything; takes effect on restart.
  const fix = async () => {
    setBusy(true);
    try { setRep(await repair(true)); setDiag(await getDbDiagnostics()); } catch (e) { onError(e); }
    setBusy(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch {
      area.current?.focus();
      area.current?.select();
    }
  };

  return (
    <section className="st-section" aria-label="Database check">
      <Head>Database check</Head>
      <Row end={<button type="button" disabled={busy} onClick={run}>Run check</button>}>
        Inspect applied migrations and tables
      </Row>
      {diag && (
        <>
          <p>{explainLoadProblem(diag.loadProblem)}</p>
          {diag.loadProblem && <p className="ui-meta">Details ({diag.loadProblemSource}): {diag.loadProblem}</p>}
          {rep && (rep.fixes.length > 0 || rep.error) && <p className="ui-meta">At startup: {describeRepair(rep)}</p>}
          <Row end={<ConfirmButton label="Repair database" disabled={busy} onConfirm={fix} title="Backs up sentinel.db first" />}>
            Back up, then fix the update record (restart afterwards)
          </Row>
          {diag.error && <p className="ui-meta">Query error: {diag.error}</p>}
          <p className="ui-meta">Applied versions: {diag.migrations.filter((m) => m.success).map((m) => m.version).join(", ") || "none"}</p>
          <ul className="ui-meta">
            {diag.migrations.map((m) => (
              <li key={m.version}>{m.version} {m.description} {m.success ? "ok" : "FAILED"} {m.checksum}</li>
            ))}
          </ul>
          <p className="ui-meta">Tables: {diag.tables.join(", ") || "(none)"}</p>
          <Row end={<button type="button" onClick={copy}>{copied ? "Copied" : "Copy report"}</button>}>Report</Row>
          <textarea ref={area} readOnly rows={6} value={report} aria-label="Database report" style={{ width: "100%" }} />
        </>
      )}
    </section>
  );
}
