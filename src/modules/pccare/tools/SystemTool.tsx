import { invoke } from "@tauri-apps/api/core";
import { ErrorLine } from "../../../ui/kit";
import { useTask } from "../useTask";

interface Plan { guid: string; name: string; active: boolean }
interface Consent { capability: string; app: string; allowed: boolean }

// Power plans (switch), pending updates/problem devices and the mic/camera/location audit (read-only).
export function SystemTool() {
  const p = useTask<Plan[]>();
  const u = useTask<[string[], string[]]>();
  const a = useTask<Consent[]>();
  const set = (g: string) => p.go(async () => { await invoke("set_power_plan", { guid: g }); return invoke<Plan[]>("power_plans"); });
  return (
    <div className="pc-tool">
      <h3 className="ui-sub">Power plan</h3>
      <div className="ui-actions">
        <button type="button" className="ui-btn" disabled={p.busy} onClick={() => void p.go(() => invoke<Plan[]>("power_plans"))}>Load plans</button>
        {p.data?.map((x) => (
          <button key={x.guid} type="button" className={`ui-btn${x.active ? " primary" : ""}`} aria-pressed={x.active} disabled={p.busy || x.active} onClick={() => void set(x.guid)}>{x.name}</button>
        ))}
      </div>
      {p.error && <ErrorLine message={p.error} />}
      <h3 className="ui-sub">Updates and drivers (best effort)</h3>
      <button type="button" className="ui-btn" disabled={u.busy} onClick={() => void u.go(() => invoke<[string[], string[]]>("pending_updates"))}>{u.busy ? "Checking… (can take a minute)" : "Check pending"}</button>
      {u.error && <ErrorLine message={u.error} />}
      {u.data && (
        <ul className="pc-list">
          {u.data[0].map((x) => <li key={x}>Update: {x}</li>)}
          {u.data[1].map((x) => <li key={x}>Device problem: {x}</li>)}
          {!u.data[0].length && !u.data[1].length && <li className="ui-meta">Nothing pending reported.</li>}
        </ul>
      )}
      <h3 className="ui-sub">App permissions (read-only)</h3>
      <button type="button" className="ui-btn" disabled={a.busy} onClick={() => void a.go(() => invoke<Consent[]>("permission_audit"))}>Audit mic / camera / location</button>
      {a.error && <ErrorLine message={a.error} />}
      <ul className="pc-list">
        {a.data?.map((c) => <li key={c.capability + c.app}><b>{c.capability}</b> <span className="pc-path">{c.app}</span> <span className="ui-meta">{c.allowed ? "allowed" : "denied"}</span></li>)}
      </ul>
    </div>
  );
}
