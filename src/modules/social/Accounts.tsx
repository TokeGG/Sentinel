import type { ModuleManifest } from "../../core/module";
import { CredentialFields } from "../../core/panel/CredentialFields";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";

export type Status = { id: string; label: string; connected: boolean; canPost: boolean };

// Collapsible account management: keychain-backed credential fields (the
// existing CredentialFields), OAuth Connect buttons, per-platform state, and
// the opt-in auto-refresh toggle (off until the user enables it).
export function Accounts({ module, status, busy, run }: {
  module: ModuleManifest; status: Status[]; busy: boolean; run: (skill: string) => Promise<unknown>;
}) {
  const connects = (module.actions ?? []).filter((a) => a.skill.startsWith("connect_"));
  return (
    <details className="ui-token">
      <summary>Accounts · {status.filter((s) => s.connected).length} connected</summary>
      <ul className="soc-accounts">
        {status.map((s) => (
          <li key={s.id}>
            <span>{s.label}</span>
            <span className="ui-meta">
              {s.connected ? (s.canPost ? "connected · read + post" : "connected · read-only") : s.id === "x" ? "not available (paid API)" : "not connected"}
            </span>
          </li>
        ))}
      </ul>
      <CredentialFields module={module} />
      <div className="ui-controls">
        {connects.map((a) => (
          <button key={a.skill} type="button" className="ui-btn" disabled={busy} onClick={() => void run(a.skill)}>{a.label}</button>
        ))}
        <ScheduleToggle module={module} />
      </div>
    </details>
  );
}
