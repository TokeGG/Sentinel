// Settings > System: alert thresholds, startup delay, low-power mode, Home Network scan interval,
// ping targets and device nicknames.
import { useEffect, useState } from "react";
import { Row } from "../../ui/kit";
import { Head, Switch } from "./Switch";
import { NumField, useSys } from "../privacy/fields";
import { getNicknames, getTargets, saveNickname, saveTargets } from "../../modules/homenet/extraOps";
import { splitTargets } from "../../modules/homenet/extras";
import { loadDevices } from "../../modules/homenet/netStore";

function NetExtras({ onError }: { onError(e: unknown): void }) {
  const [targets, setTargets] = useState("");
  const [devs, setDevs] = useState<{ mac: string; ip: string }[]>([]);
  const [nicks, setNicks] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  useEffect(() => {
    getTargets().then((t) => setTargets(t.join("\n"))).catch(onError);
    getNicknames().then(setNicks).catch(onError);
    loadDevices().then((r) => setDevs(r.map((x) => ({ mac: String(x.mac), ip: String(x.ip) })))).catch(onError);
  }, []);
  const save = async () => {
    const t = splitTargets(targets);
    try { await saveTargets(t); setTargets(t.join("\n")); setMsg(`${t.length} target(s) saved`); } catch (e) { onError(e); }
  };
  return (
    <>
      <Row><label className="st-switch">Ping targets <small className="ui-meta">IPv4 addresses, one per line (Home Network "Ping my targets")</small></label></Row>
      <Row><textarea className="ui-input" rows={3} aria-label="Ping targets" value={targets} onChange={(e) => setTargets(e.target.value)} />
        <button className="ui-btn ui-sm" onClick={() => void save()}>Save</button>{msg && <span className="ui-meta">{msg}</span>}</Row>
      <details><summary className="ui-meta">Device nicknames ({devs.length} devices)</summary>
        {devs.map((d) => (
          <Row key={d.mac}><span className="ui-meta">{d.ip} {d.mac}</span>
            <input className="ui-input" aria-label={`Nickname for ${d.mac}`} defaultValue={nicks[d.mac.toLowerCase()] ?? ""} placeholder="Nickname"
              onBlur={(e) => saveNickname(d.mac, e.target.value).catch(onError)} /></Row>
        ))}
      </details>
    </>
  );
}

export function SystemSection({ onError }: { onError(e: unknown): void }) {
  const [p, set] = useSys(onError);
  if (!p) return null;
  return (
    <section className="st-section" aria-label="System">
      <Head>System</Head>
      <Row><NumField label="Temperature warning at" value={p.tempWarnC} min={40} max={110} unit="°C" onSave={(n) => set({ tempWarnC: n })} /></Row>
      <Row><NumField label="Disk alert at" value={p.diskAlertPct} min={50} max={99} unit="% full" onSave={(n) => set({ diskAlertPct: n })} /></Row>
      <Row><NumField label="Startup delay" value={p.startupDelaySec} min={0} max={120} unit="seconds" hint="wait before reopening panels" onSave={(n) => set({ startupDelaySec: n })} /></Row>
      <Row><Switch checked={p.lowPower} onChange={(v) => set({ lowPower: v })}>
        Low-power mode <small className="ui-meta">stops star and orbit animation</small></Switch></Row>
      <Row><NumField label="Home Network re-scan every" value={p.scanHours} min={0} max={168} unit="hours"
        hint="0 = off. Only while Home Network Auto-refresh is on." onSave={(n) => set({ scanHours: n })} /></Row>
      <NetExtras onError={onError} />
    </section>
  );
}
