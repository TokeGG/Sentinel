import { useState } from "react";
import type { ModuleState } from "../../ui/useModule";

// Import a Google Takeout watch-history.json (read in the webview; nothing is
// uploaded) and clear the local history behind a confirm step.
export function HistoryTools({ busy, run, count }: { busy: boolean; run: ModuleState["run"]; count: number }) {
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function pick(file: File | undefined) {
    if (!file) return;
    const out = (await run("import_history", { text: await file.text() })) as { count?: number } | undefined;
    if (out) setMsg(`Imported ${out.count ?? 0} item(s)`);
  }
  return (
    <div className="ui-controls">
      <label className="ui-btn">
        Import watch-history.json
        <input type="file" accept=".json,application/json" hidden disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {confirm ? (
        <>
          <span className="ui-meta">Delete {count} history item(s)?</span>
          <button type="button" className="ui-btn" disabled={busy} onClick={async () => { await run("clear_history"); setConfirm(false); }}>Yes, clear</button>
          <button type="button" className="ui-btn" onClick={() => setConfirm(false)}>Cancel</button>
        </>
      ) : (
        <button type="button" className="ui-btn" disabled={busy || count === 0} onClick={() => setConfirm(true)}>Clear history</button>
      )}
      {msg && <span className="ui-meta" role="status">{msg}</span>}
    </div>
  );
}
