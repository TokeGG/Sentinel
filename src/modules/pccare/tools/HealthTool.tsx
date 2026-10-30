// Health: threshold alerts, disk-full forecast, speed history chart, per-app power share, desktop clean-up.
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Spark } from "../../../ui/kit";
import { parseSys, SYS_KEY } from "../../../shell/privacy/sysPrefs";
import { getSetting } from "../../../ui/appSetting";
import { diskAlerts, hotSensors, planDesktop, powerShare, speedSeries, type Disk, type Proc, type Sensor } from "../alerts";
import { forecast, forecastText } from "../forecast";
import { speedHistory } from "../speedStore";
import { diskHistory } from "../sysOps";
import type { DirFile, Move } from "../sorter";
import { useTask } from "../useTask";

interface Report { alerts: string[]; forecasts: string[]; speeds: number[]; power: { name: string; share: number }[] | null }

async function read(): Promise<Report> {
  const p = parseSys(await getSetting(SYS_KEY));
  const m = await invoke<{ disks: Disk[] }>("get_pc_metrics");
  const s = await invoke<Sensor[]>("list_sensors").catch(() => []);
  const hist = await diskHistory();
  const procs = await invoke<Proc[]>("list_processes").catch(() => []);
  return {
    alerts: [...diskAlerts(m.disks, p.diskAlertPct), ...hotSensors(s, p.tempWarnC)],
    forecasts: m.disks.map((d) => forecastText(forecast(hist, d.mount))),
    speeds: speedSeries(await speedHistory()), power: powerShare(procs),
  };
}

export function HealthTool() {
  const t = useTask<Report>();
  const d = useTask<{ dir: string; plan: Move[] }>();
  const [msg, setMsg] = useState("");
  const loadDesk = () => d.go(async () => {
    const dir = await (await import("@tauri-apps/api/path")).desktopDir();
    return { dir, plan: planDesktop(dir, await invoke<DirFile[]>("list_dir_files", { path: dir })) };
  });
  const apply = async () => { const n = await invoke<number>("apply_moves", { base: d.data!.dir, moves: d.data!.plan }); setMsg(`${n} file(s) moved`); d.setData(null); };
  const r = t.data;
  return (
    <div className="pc-tool">
      <button className="ui-btn" disabled={t.busy} onClick={() => void t.go(read)}>Check health</button>
      {t.error && <div className="ui-meta">{t.error}</div>}
      {r && <>
        <div><b>Alerts</b> {r.alerts.length ? r.alerts.map((a) => <div key={a}>{a}</div>) : <span className="ui-meta">none (thresholds in Settings &gt; System)</span>}</div>
        <div><b>Disk forecast</b> {r.forecasts.map((f) => <div key={f} className="ui-meta">{f}</div>)}</div>
        <div><b>Speed history</b> {r.speeds.length ? <><Spark points={r.speeds} /> <span className="ui-meta">{r.speeds.length} tests, last {r.speeds[r.speeds.length - 1]} Mbps</span></> : <span className="ui-meta">no speed tests yet (Network tab)</span>}</div>
        <div><b>Power use by app</b> <span className="ui-meta">(share of CPU, a best-effort estimate)</span>
          {r.power ? r.power.map((x) => <div key={x.name} className="ui-meta">{x.name}: {x.share}%</div>) : <div className="ui-meta">not available</div>}</div>
      </>}
      <div><b>Clean desktop</b> <button className="ui-btn ui-sm" disabled={d.busy} onClick={() => void loadDesk()}>Preview</button></div>
      {d.data && (
        <div className="ui-banner">
          {d.data.plan.length ? d.data.plan.map((m) => <div key={m.from} className="ui-meta">{m.name} → {m.folder}</div>) : "Nothing to sort (shortcuts stay)."}
          {d.data.plan.length > 0 && <button className="ui-btn primary" onClick={() => void apply().catch((e) => setMsg(String(e)))}>Move {d.data.plan.length} file(s)</button>}
        </div>
      )}
      {msg && <div className="ui-meta" role="status">{msg}</div>}
    </div>
  );
}
