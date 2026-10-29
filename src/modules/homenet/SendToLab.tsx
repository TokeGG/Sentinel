import { useEffect, useState } from "react";
import type { ModuleState } from "../../ui/useModule";
import { addInclude } from "../pentest/scopeAdd";
import { listEngagements } from "../pentest/store";
import type { EngagementRow } from "../pentest/types";

type Props = { mac: string; ip: string; busy: boolean; run: ModuleState["run"] };

/** Add this device's IP as an explicit include of an ACTIVE engagement, after showing exactly what will change. */
export function SendToLab({ mac, ip, busy, run }: Props) {
  const [active, setActive] = useState<EngagementRow[]>([]);
  const [id, setId] = useState("");
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (asking) listEngagements().then((l) => setActive(l.filter((e) => e.status === "active"))).catch(() => {}); }, [asking]);
  const eng = active.find((e) => String(e.id) === id);
  const plan = eng ? addInclude(eng, ip) : null;
  if (!asking) return <button type="button" className="ui-btn" disabled={busy} onClick={() => setAsking(true)}>Send to Lab…</button>;
  return (
    <div className="ui-banner" role="alertdialog" aria-label="Send to Lab">
      {!active.length ? <span>No active engagement. Activate one in the Pentest Lab first.</span> : (
        <select className="ui-select" value={id} onChange={(e) => setId(e.target.value)} aria-label="Engagement">
          <option value="">choose an active engagement</option>
          {active.map((e) => <option key={e.id} value={e.id}>#{e.id} {e.client}</option>)}
        </select>
      )}
      {eng && plan && (plan.ok
        ? <div className="ui-meta">{plan.already ? `${plan.entry} is already an include of "${eng.client}".` : `Will add the explicit include "${plan.entry}" to "${eng.client}". New include list: ${plan.include}`}</div>
        : <div className="ui-meta">{plan.error}</div>)}
      {msg && <div className="ui-meta">{msg}</div>}
      <div className="ui-actions">
        <button type="button" className="ui-btn primary" disabled={busy || !plan?.ok || plan.already}
          onClick={async () => { const r = await run("send_to_lab", { mac, engagementId: Number(id) }); if (r !== undefined) { setMsg("Added."); setAsking(false); } }}>Confirm and add</button>
        <button type="button" className="ui-btn" onClick={() => setAsking(false)}>Cancel</button>
      </div>
    </div>
  );
}
