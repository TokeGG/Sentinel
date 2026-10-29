import { invoke } from "@tauri-apps/api/core";
import { ConfirmButton } from "../../../ui/ConfirmButton";
import { EmptyState, ErrorLine } from "../../../ui/kit";
import { useTask } from "../useTask";

interface Entry { id: string; source: string; name: string; command: string; enabled: boolean }
const SRC: Record<string, string> = { hkcu: "You (Run key)", hklm: "All users (Run key)", folder: "Startup folder" };

// Disable/enable flips the StartupApproved flag (what Task Manager does): reversible, entry untouched.
export function StartupTool() {
  const t = useTask<Entry[]>();
  const load = () => t.go(() => invoke<Entry[]>("list_startup"));
  const flip = async (e: Entry) => { await t.go(async () => { await invoke("set_startup_enabled", { id: e.id, enabled: !e.enabled }); return invoke<Entry[]>("list_startup"); }); };
  return (
    <div className="pc-tool">
      <div className="ui-actions">
        <button type="button" className="ui-btn primary" disabled={t.busy} onClick={() => void load()}>List startup programs</button>
        <span className="ui-meta">Disabling is reversible; nothing is deleted.</span>
      </div>
      {t.error && <ErrorLine message={t.error} />}
      {t.data && !t.data.length && <EmptyState title="No startup entries found" />}
      <ul className="pc-list">
        {t.data?.map((e) => (
          <li key={e.id}>
            <b>{e.name}</b> <span className="ui-meta">{SRC[e.source] ?? e.source} · {e.enabled ? "enabled" : "disabled"}</span>
            <div className="ui-meta pc-path" title={e.command}>{e.command}</div>
            <ConfirmButton className="ui-btn ui-sm" label={e.enabled ? "Disable at startup" : "Enable at startup"} disabled={t.busy} onConfirm={() => void flip(e)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
