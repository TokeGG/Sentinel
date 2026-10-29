import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { safeLink } from "../../ui/safeLink";
import { gatewayIp } from "./netOps";
import { mapLayout, routerUrl } from "./netLogic";

type Dev = { mac: string; ip: string; label: string };

// Star map: router in the middle (from the OS default gateway), every known device around it.
export function NetMap({ devices }: { devices: Dev[] }) {
  const [gw, setGw] = useState<string | null>(null);
  useEffect(() => { gatewayIp().then(setGw).catch(() => setGw(null)); }, []);
  const nodes = mapLayout(devices, gw);
  const hub = nodes[0];
  const link = safeLink(routerUrl(gw));
  return (
    <div className="hn-map">
      <div className="ui-actions">
        <span className="ui-meta">Gateway: {gw ?? "unknown"}</span>
        {link && <button type="button" className="ui-btn ui-sm" onClick={() => void openUrl(link)}>Open router admin</button>}
      </div>
      <svg viewBox="0 0 400 300" role="img" aria-label="Network map">
        {nodes.slice(1).map((n) => <line key={`l${n.id}`} x1={hub.x} y1={hub.y} x2={n.x} y2={n.y} />)}
        {nodes.map((n) => (
          <g key={n.id} className={n.gateway ? "gw" : ""}>
            <circle cx={n.x} cy={n.y} r={n.gateway ? 14 : 9}><title>{n.label}</title></circle>
            <text x={n.x} y={n.y + (n.gateway ? 28 : 22)} textAnchor="middle">{n.label.slice(0, 16)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
