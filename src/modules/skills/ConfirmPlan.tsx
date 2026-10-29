// The confirmation screen: nothing is written until "Install"/"Update" is pressed.
import { diffEmpty, diffSummary } from "./installPlan";
import type { Plan } from "./install";
import { Tile } from "../../ui/kit";

export function ConfirmPlan({ plan, busy, onConfirm, onCancel }: { plan: Plan; busy: boolean; onConfirm(): void; onCancel(): void }) {
  const upd = plan.previousSha !== undefined;
  const m = plan.mcp;
  return (
    <Tile title={`${upd ? "Update" : "Install"} ${plan.kind === "mcp" ? "MCP server" : "skill"}: ${plan.name}`}>
      <dl className="sk-facts">
        <dt>Repository</dt><dd>{plan.source.owner}/{plan.source.repo}{plan.source.subdir && ` / ${plan.source.subdir}`}</dd>
        <dt>Pinned commit</dt><dd className="sk-mono">{plan.sha} <span className="ui-meta">({plan.ref})</span></dd>
        {upd && <><dt>Replaces</dt><dd className="sk-mono">{plan.previousSha}{plan.diff && ` - ${diffEmpty(plan.diff) ? "no file changes" : diffSummary(plan.diff)}`}</dd></>}
        {m && <>
          <dt>Will run</dt><dd className="sk-mono">{[m.command, ...m.args].map((a) => JSON.stringify(a)).join(" ")}</dd>
          <dt>Plain env</dt><dd className="sk-mono">{Object.entries(m.env).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}</dd>
          <dt>Secret env names</dt><dd className="sk-mono">{m.secretNames.join(", ") || "none"} <span className="ui-meta">(values stay in the OS keychain)</span></dd>
          <dt>Pentest-flagged tools</dt><dd className="sk-mono">{m.flagged.join(", ") || "none beyond names containing pentest/scan/exploit"}</dd>
        </>}
      </dl>
      <p className="ui-meta">{plan.files.length} file(s) will be written inside Sentinel's app folder{plan.skipped.length ? `; ${plan.skipped.length} skipped (non-text, hidden, lockfiles or oversize)` : ""}:</p>
      <div className="ui-files">
        {plan.files.map((f) => {
          const d = plan.diff;
          const tag = d?.added.includes(f.path) ? "new " : d?.changed.includes(f.path) ? "changed " : "";
          return <div key={f.path}>{tag}{f.path} ({f.size} B)</div>;
        })}
        {plan.diff?.removed.map((p) => <div key={p}>removed {p}</div>)}
      </div>
      {m && <p className="ui-meta">This code runs on your computer with your user rights, only after you switch the server on.</p>}
      <div className="ui-controls">
        <button type="button" className="ui-btn primary" disabled={busy} onClick={onConfirm}>{upd ? "Confirm update" : "Confirm install"}</button>
        <button type="button" className="ui-btn" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </Tile>
  );
}
