import { useRef, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { Chip, EmptyState, ErrorLine } from "../../ui/kit";
import { Section, Sections, useSections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { deviceName, deviceState, newDevices, sortDevices } from "./panelLogic";
import "./homenet.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, updated, run } = useModule(module);
  const hasScan = useSections().includes("scan");
  const [mac, setMac] = useState("");
  const [tag, setTag] = useState("");
  // No first_seen column exists, so "new" = appeared since this panel's first load.
  const known = useRef<Set<string> | null>(null);
  if (known.current === null && updated) known.current = new Set(rows.map((r) => String(r.id)));
  const fresh = new Set(newDevices(rows, known.current ?? new Set(rows.map((r) => String(r.id)))).map((r) => String(r.id)));
  const devices = sortDevices<Record<string, unknown>>(rows).map((r) => ({
    id: r.id,
    ip: r.ip,
    mac: r.mac,
    tag: r.tag,
    name: deviceName(r) ?? "Unknown device",
    unknown: deviceName(r) === null,
    isNew: fresh.has(String(r.id)),
  }));
  const selected = mac || String(devices[0]?.mac ?? "");
  return (
    <div className="hn">
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{rows.length}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="summary">
          <div className="ui-chips">
            <Chip>{rows.length} {rows.length === 1 ? "device" : "devices"}</Chip>
            <Chip on={fresh.size > 0}>{fresh.size} new this session</Chip>
          </div>
        </Section>
        <Section id="devices">
          {devices.length ? (
            <ul className="hn-list">
              <li className="hn-head" aria-hidden="true"><span /><span>Name</span><span>IP</span><span>MAC</span></li>
              {devices.map((d) => {
                const st = deviceState(d);
                return (
                  <li key={String(d.id)} className={`hn-dev ${st}`}>
                    <i className="hn-dot" title={st} />
                    <span className="hn-name">{d.name}{d.isNew && <em className="hn-new">NEW</em>}</span>
                    <span className="hn-ip">{String(d.ip)}</span>
                    <span className="hn-mac">{String(d.mac)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title={hasScan ? "No devices yet — run a scan." : "No devices yet."} />
          )}
        </Section>
        <Section id="scan">
          <div className="ui-actions">
            <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void run("scan_network")}>
              {busy ? "Working…" : "Scan network"}
            </button>
            <span className="ui-meta">Reads the OS ARP cache — passive.</span>
          </div>
        </Section>
        <Section id="tag">
          {devices.length === 0 ? (
            <EmptyState title="Nothing to tag" hint={hasScan ? "Scan first." : "No devices known yet."} />
          ) : (
            <form
              className="ui-quickadd"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selected) return;
                if ((await run("tag_device", { mac: selected, tag: tag.trim() })) !== undefined) setTag("");
              }}
            >
              <select className="ui-select" aria-label="Device" value={selected} onChange={(e) => setMac(e.target.value)} disabled={busy}>
                {devices.map((d) => (
                  <option key={String(d.mac)} value={String(d.mac)}>{String(d.ip)} · {String(d.mac)}</option>
                ))}
              </select>
              <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag, e.g. NAS (empty clears)" aria-label="Tag" disabled={busy} />
              <button type="submit" className="ui-btn primary" disabled={busy || !selected}>Save tag</button>
            </form>
          )}
        </Section>
      </Sections>
    </div>
  );
}
