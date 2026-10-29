// Settings > Export: encrypted (passphrase) export/import with a preview step.
import { useState } from "react";
import { Row } from "../../ui/kit";
import type { Bundle, ImportStep } from "../../core/crypto/exportLogic";
import { applyImport, exportAll, previewImport } from "./exportData";
import { Head } from "./Switch";

export function ExportSection({ onError }: { onError(e: unknown): void }) {
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<{ bundle: Bundle; plan: ImportStep[] } | null>(null);
  const go = (f: () => Promise<void>) => () => f().catch(onError);
  return (
    <section className="st-section" aria-label="Export">
      <Head>Encrypted export</Head>
      <Row><span className="ui-meta">Settings, layouts, bot brains, notes and other local data. Passwords and tokens stay in the OS keychain and are never exported.</span></Row>
      <Row end={<>
        <button type="button" className="ui-btn" disabled={pass.length < 8} onClick={go(async () => { const p = await exportAll(pass); setMsg(p ? `Exported to ${p}` : null); })}>Export...</button>
        <button type="button" className="ui-btn" disabled={pass.length < 8} onClick={go(async () => { setPending(await previewImport(pass)); setMsg(null); })}>Import...</button>
      </>}>
        <input type="password" className="st-input" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase (8+ characters)" aria-label="Export passphrase" autoComplete="new-password" />
      </Row>
      {pending && (
        <div className="st-preview">
          <p>Import will add or replace rows in {pending.plan.length} tables (from {pending.bundle.at}):</p>
          <ul>{pending.plan.map((s) => <li key={s.table}>{s.table}: {s.rows} rows</li>)}</ul>
          <button type="button" className="ui-btn" onClick={go(async () => { const n = await applyImport(pending.bundle, pending.plan); setPending(null); setMsg(`Imported ${n} rows. Restart Sentinel to see everything.`); })}>Apply import</button>
          <button type="button" className="ui-btn" onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}
      {msg && <Row><span className="ui-meta">{msg}</span></Row>}
    </section>
  );
}
