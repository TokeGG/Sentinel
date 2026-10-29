import { useState } from "react";
import { ErrorLine } from "../../ui/kit";
import type { ModuleState } from "../../ui/useModule";
import { useDemo } from "./useDemo";

/** Teach by demo: the bot browser opens visible and records your clicks and typing (never password fields). */
export function DemoBox({ run, busy, reload }: { run: ModuleState["run"]; busy: boolean; reload(): void }) {
  const d = useDemo();
  const [url, setUrl] = useState("https://");
  const [name, setName] = useState("");
  const save = async () => { if ((await run("save_demo", { events: d.events, name, goal: name })) !== undefined) { d.clear(); setName(""); reload(); } };
  return (
    <details className="ui-token">
      <summary>Teach by demo</summary>
      <div className="ui-quickadd">
        <input value={url} onChange={(e) => setUrl(e.target.value)} disabled={d.recording} aria-label="Demo start address" />
        {d.recording
          ? <button type="button" className="ui-btn primary" onClick={() => void d.stop()}>Stop recording</button>
          : <button type="button" className="ui-btn" disabled={busy} onClick={() => void d.start(url.trim())}>Record</button>}
      </div>
      <p className="ui-meta">{d.recording ? "Recording in the bot window... " : ""}{d.events.filter((e) => e.kind !== "nav").length} steps recorded. Password fields are never recorded.</p>
      {d.error && <ErrorLine message={d.error} />}
      {!d.recording && d.events.length > 0 && (
        <div className="ui-quickadd">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this workflow" aria-label="Demo name" />
          <button type="button" className="ui-btn primary" disabled={busy || !name.trim()} onClick={() => void save()}>Save draft</button>
        </div>
      )}
    </details>
  );
}
