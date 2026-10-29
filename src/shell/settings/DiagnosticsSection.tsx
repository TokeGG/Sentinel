import { useRef, useState } from "react";
import { getDbDiagnostics } from "../../core/db";
import { describeDb, type DbDiagnostics } from "../../core/schema";
import { Row } from "../../ui/kit";
import { Head } from "./Switch";

// Manual only: nothing runs until the user presses "Run check".
export function DiagnosticsSection({ onError }: { onError(e: unknown): void }) {
  const [diag, setDiag] = useState<DbDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const report = diag ? describeDb(diag) : "";

  const run = async () => {
    setBusy(true);
    setCopied(false);
    try { setDiag(await getDbDiagnostics()); } catch (e) { onError(e); }
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
          {diag.loadProblem && <p className="ui-meta">Load problem ({diag.loadProblemSource}): {diag.loadProblem}</p>}
          {diag.error && <p className="ui-meta">Query error: {diag.error}</p>}
          <p className="ui-meta">Migrations ({diag.migrations.length})</p>
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
