import { useState } from "react";
import type { ModuleState } from "../../ui/useModule";
import { brainRows, variantRows } from "./brainOps";
import { bestVariant } from "./kernel/variants";
import type { LearnState } from "./learn";

export function BrainPane({ state, run, busy, reload }: { state: LearnState | null; run: ModuleState["run"]; busy: boolean; reload(): void }) {
  const [text, setText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState("");
  if (!state) return <p className="ui-meta">Loading...</p>;
  const best = bestVariant(state.pop);
  const go = async (skill: string, args?: Record<string, unknown>) => { const r = await run(skill, args); if (r !== undefined) { reload(); return r; } };
  const exp = async () => { const r = (await run("export_brain")) as { text: string; saved: string | null } | undefined; if (r) { setText(r.text); setMsg(r.saved ? `Saved to ${r.saved}` : "Not saved to a file; copy it from the box."); } };
  const pickFile = async (f?: File) => { if (f) setText((await f.text()).slice(0, 100_000)); };
  return (
    <div className="bot-goal">
      <p className="ui-meta">Active variant <span className="bot-mono">{best.id}</span> (generation {state.pop.generation}). Numbers that moved from the shipped brain are highlighted.</p>
      <table className="bot-table"><thead><tr><th>Number</th><th>Active</th><th>Shipped</th></tr></thead><tbody>
        {brainRows(best.brain).map((r) => <tr key={r.name} className={r.moved ? "moved" : ""}><td>{r.name}</td><td>{r.active}</td><td>{r.shipped}</td></tr>)}
      </tbody></table>
      <table className="bot-table"><thead><tr><th>Variant</th><th>Wins / runs</th><th>Win rate</th></tr></thead><tbody>
        {variantRows(state.pop).map((v) => <tr key={v.id}><td className="bot-mono">{v.id}{v.best ? " (best)" : ""}</td><td>{v.wins} / {v.games}</td><td>{v.winRate}</td></tr>)}
      </tbody></table>
      <textarea className="ui-file-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="botbrain.json text (normal + lab brains): Export fills this; paste or pick a file to Import" aria-label="Brain JSON" />
      <div className="ui-actions">
        <button type="button" className="ui-btn" disabled={busy} onClick={() => void exp()}>Export...</button>
        <label className="ui-btn">Pick file...<input type="file" accept=".json,application/json" hidden onChange={(e) => void pickFile(e.target.files?.[0])} /></label>
        <button type="button" className="ui-btn" disabled={busy || !text.trim()} onClick={() => void go("import_brain", { text })}>Import</button>
        <button type="button" className="ui-btn" disabled={busy} onClick={() => setConfirmReset(true)}>Reset to shipped...</button>
        <button type="button" className="ui-btn" disabled={busy} title="The Lab bot starts from this brain" onClick={() => void go("share_brain", { direction: "toLab" }).then((r) => r && setMsg("Copied to the Lab brain."))}>Copy to Lab</button>
        <button type="button" className="ui-btn" disabled={busy} title="This brain starts from the Lab bot's brain" onClick={() => void go("share_brain", { direction: "toNormal" }).then((r) => r && setMsg("Copied from the Lab brain."))}>Copy from Lab</button>
      </div>
      {msg && <p className="ui-meta">{msg}</p>}
      {confirmReset && (
        <div className="ui-banner" role="alertdialog" aria-label="Confirm reset">
          <strong>Reset the brain to the shipped numbers?</strong>
          <div className="ui-meta">All variants, win records and lessons the bot learned are discarded.</div>
          <div className="ui-actions">
            <button type="button" className="ui-btn primary" disabled={busy} onClick={async () => { setConfirmReset(false); await go("reset_brain"); }}>Reset</button>
            <button type="button" className="ui-btn" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
