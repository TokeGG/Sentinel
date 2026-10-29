import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import { deviceInfo, portsText } from "./deviceInfo";
import { SendToLab } from "./SendToLab";
import { DEVICE_ICONS } from "./netLogic";

export interface Dev { id: unknown; ip: unknown; mac: unknown; tag: unknown; name: string; isNew: boolean; state: string; raw: Record<string, unknown> }
type Props = { d: Dev; busy: boolean; run: ModuleState["run"] };

export function DeviceRow({ d, busy, run }: Props) {
  const [open, setOpen] = useState(false);
  const i = deviceInfo(d.raw, new Map(Array.isArray(d.raw.ports) ? [[String(d.ip).trim(), d.raw.ports as number[]]] : []));
  const [host, setHost] = useState(i.hostname);
  const [notes, setNotes] = useState(i.notes);
  const pc = d.raw.portChange as { opened: number[]; closed: number[] } | null;
  return (
    <li className={`hn-dev ${d.state}`}>
      <i className="hn-dot" title={d.state} />
      <span className="hn-name">
        {d.raw.icon ? <em className="hn-icon">{String(d.raw.icon)}</em> : null}
        <button type="button" className="ui-link" aria-expanded={open} onClick={() => setOpen(!open)}>{d.name}</button>
        {d.isNew && <em className="hn-new">NEW</em>}
      </span>
      <span className="hn-ip">{String(d.ip)}</span>
      <span className="hn-mac">{String(d.mac)} <ConfirmButton label="Forget" className="ui-btn ui-sm" disabled={busy} title="Remove from the saved list (comes back if a scan sees it again)" onConfirm={() => void run("forget_device", { mac: d.mac })} /></span>
      {open && (
        <div className="hn-detail">
          <div className="ui-meta">{i.hostname || "no hostname set"} · {i.vendor} · open ports: {portsText(i.ports)}</div>
          <div className="ui-meta">first seen {i.firstSeen} · last seen {i.lastSeen} · uptime {d.raw.uptime == null ? "not pinged" : `${String(d.raw.uptime)}%`}</div>
          {pc && <div className="ui-meta hn-alert">Ports changed since the previous scan: {pc.opened.length ? `opened ${pc.opened.join(", ")}` : ""} {pc.closed.length ? `closed ${pc.closed.join(", ")}` : ""}</div>}
          <div className="ui-actions">
            <select className="ui-select" aria-label="Icon" value={String(d.raw.icon ?? "")} disabled={busy} onChange={(e) => void run("set_icon", { mac: d.mac, icon: e.target.value })}>
              {DEVICE_ICONS.map((x) => <option key={x} value={x}>{x || "No icon"}</option>)}
            </select>
            <button type="button" className="ui-btn ui-sm" disabled={busy} title="Sends a wake-on-LAN magic packet on your local network" onClick={() => void run("wake_device", { mac: d.mac })}>Wake</button>
          </div>
          <div className="ui-quickadd">
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Hostname" aria-label="Hostname" />
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" />
            <button type="button" className="ui-btn" disabled={busy} onClick={() => void run("device_info", { mac: d.mac, hostname: host, notes })}>Save info</button>
          </div>
          <SendToLab mac={String(d.mac)} ip={String(d.ip)} busy={busy} run={run} />
        </div>
      )}
    </li>
  );
}
