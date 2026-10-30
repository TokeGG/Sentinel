import { useLimit } from "../../../ui/useOption";
import { pccareLimits } from "../panelLogic";
import { invoke } from "@tauri-apps/api/core";
import { ErrorLine, Spark } from "../../../ui/kit";
import { runSpeedTest, speedHistory, type SpeedRow } from "../speedStore";
import { useTask } from "../useTask";

interface Listen { proto: string; addr: string; port: number; pid: number | null; process: string | null }

// Speed test (manual), own listening ports and Wi-Fi report: all read-only except the speed history row.
export function NetTool() {
  const lim = useLimit(pccareLimits, "speedRows");
  const sp = useTask<SpeedRow[]>();
  const po = useTask<Listen[]>();
  const wf = useTask<[[string, string][], string[]]>();
  const hist = sp.data ?? [];
  return (
    <div className="pc-tool">
      <h3 className="ui-sub">Speed test</h3>
      <div className="ui-actions">
        <button type="button" className="ui-btn primary" disabled={sp.busy} onClick={() => void sp.go(runSpeedTest)}>{sp.busy ? "Testing…" : "Run speed test (25 MB)"}</button>
        <button type="button" className="ui-btn" disabled={sp.busy} onClick={() => void sp.go(speedHistory)}>History</button>
        {hist.length > 0 && <><b>{hist[0].mbps} Mbps</b><Spark points={[...hist].reverse().map((h) => h.mbps)} /></>}
      </div>
      {sp.error && <ErrorLine message={sp.error} />}
      <ul className="pc-list">{hist.slice(0, lim).map((h) => <li key={h.id}>{h.at} · {h.mbps} Mbps</li>)}</ul>
      <h3 className="ui-sub">Listening ports on this PC</h3>
      <button type="button" className="ui-btn" disabled={po.busy} onClick={() => void po.go(() => invoke<Listen[]>("listening_ports"))}>Audit open ports</button>
      {po.error && <ErrorLine message={po.error} />}
      <ul className="pc-list">
        {po.data?.map((l) => <li key={`${l.proto}${l.addr}${l.port}`}><b>{l.proto.toUpperCase()} {l.port}</b> <span className="ui-meta">{l.addr} · {l.process ?? (l.pid ? `pid ${l.pid}` : "?")}{["0.0.0.0", "::"].includes(l.addr) ? " · all interfaces" : ""}</span></li>)}
      </ul>
      <h3 className="ui-sub">Wi-Fi</h3>
      <button type="button" className="ui-btn" disabled={wf.busy} onClick={() => void wf.go(() => invoke<[[string, string][], string[]]>("wifi_report"))}>Wi-Fi report</button>
      <span className="ui-meta"> Saved passwords are never read.</span>
      {wf.error && <ErrorLine message={wf.error} />}
      {wf.data && (
        <ul className="pc-list">
          {wf.data[0].map(([k, v], i) => <li key={i}><b>{k}</b> {v}</li>)}
          <li className="ui-meta">Saved profiles: {wf.data[1].join(", ") || "none"}</li>
        </ul>
      )}
    </div>
  );
}
