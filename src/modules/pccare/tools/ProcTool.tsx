import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { ConfirmButton } from "../../../ui/ConfirmButton";
import { ErrorLine } from "../../../ui/kit";
import { useTask } from "../useTask";

interface Proc { pid: number; name: string; cpu: number; mem_mb: number }
interface Sensor { label: string; temp: number | null; max: number | null; critical: number | null }

export function ProcTool() {
  const t = useTask<Proc[]>();
  const s = useTask<Sensor[]>();
  const [q, setQ] = useState("");
  const load = () => t.go(() => invoke<Proc[]>("list_processes"));
  const kill = (p: Proc) => t.go(async () => { await invoke("kill_process", { pid: p.pid, name: p.name }); return invoke<Proc[]>("list_processes"); });
  const shown = (t.data ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  return (
    <div className="pc-tool">
      <div className="ui-actions">
        <button type="button" className="ui-btn primary" disabled={t.busy} onClick={() => void load()}>List processes</button>
        <button type="button" className="ui-btn" disabled={s.busy} onClick={() => void s.go(() => invoke<Sensor[]>("list_sensors"))}>Read temperatures</button>
        <input className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter processes" />
      </div>
      {(t.error || s.error) && <ErrorLine message={String(t.error ?? s.error)} />}
      {s.data && (
        <div className="ui-meta">
          {s.data.length === 0 ? "Temperatures/fans: not available on this PC (no sensors exposed)." :
            s.data.map((x) => `${x.label}: ${x.temp == null ? "n/a" : `${x.temp.toFixed(0)}°C`}`).join(" · ")}
        </div>
      )}
      <ul className="pc-list">
        {shown.map((p) => (
          <li key={p.pid}>
            <b>{p.name}</b> <span className="ui-meta">pid {p.pid} · {p.mem_mb} MB · {p.cpu.toFixed(0)}% CPU</span>
            <ConfirmButton className="ui-btn ui-sm" label="End" disabled={t.busy} title="Ends this process; unsaved work in it is lost" onConfirm={() => void kill(p)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
