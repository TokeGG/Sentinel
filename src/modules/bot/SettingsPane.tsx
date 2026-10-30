import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import { CTX_CHOICES, DEFAULT_SETTINGS, MAX_DELAY_MS, PRESET_IDS, suggestPresets, type BotSettings, type PresetId } from "./botSettings";
import type { More } from "./useMore";

/** Model presets (fast/smart/tiny -> installed models), temperature, context size, step speed, skill-score weight. */
export function SettingsPane({ more, run, busy }: { more: More; run: ModuleState["run"]; busy: boolean }) {
  const s = more.cfg?.settings ?? DEFAULT_SETTINGS;
  const put = async (next: BotSettings) => { if ((await run("save_settings", { settings: next })) !== undefined) void more.reload(); };
  const names = more.installed.map((m) => m.name);
  const pick = (slot: "fast" | "smart" | "tiny") => (
    <label key={slot} className="schedule-toggle">{slot}{" "}
      <select className="ui-select" value={s.presets[slot]} disabled={busy} aria-label={`${slot} model`} onChange={(e) => void put({ ...s, presets: { ...s.presets, [slot]: e.target.value } })}>
        <option value="">(local model)</option>
        {[...new Set([...names, s.presets[slot]].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
  return (
    <div className="bot-goal">
      <div className="ui-controls">
        <label className="schedule-toggle">Model for runs{" "}
          <select className="ui-select" value={s.preset} disabled={busy} aria-label="Model preset" onChange={(e) => void put({ ...s, preset: e.target.value as PresetId })}>
            {PRESET_IDS.map((p) => <option key={p} value={p}>{p === "default" ? "Local model (Skills panel)" : p}</option>)}
          </select>
        </label>
        <button type="button" className="ui-btn" onClick={() => void more.findModels()}>Find models</button>
        <button type="button" className="ui-btn" disabled={busy || !names.length} onClick={() => void put({ ...s, presets: suggestPresets(more.installed) })}>Suggest by size</button>
      </div>
      <div className="ui-controls">{(["fast", "smart", "tiny"] as const).map(pick)}</div>
      <div className="ui-controls">
        <label className="schedule-toggle"><input type="checkbox" checked={s.temperature === null} disabled={busy} onChange={(e) => void put({ ...s, temperature: e.target.checked ? null : 0.2 })} /> Learned temperature</label>
        {s.temperature !== null && (
          <label className="schedule-toggle">Temperature {s.temperature.toFixed(2)}{" "}
            <input type="range" min={0} max={1.5} step={0.05} value={s.temperature} disabled={busy} aria-label="Temperature" onChange={(e) => void put({ ...s, temperature: Number(e.target.value) })} />
          </label>
        )}
        <label className="schedule-toggle">Context{" "}
          <select className="ui-select" value={s.numCtx} disabled={busy} aria-label="Context size" onChange={(e) => void put({ ...s, numCtx: Number(e.target.value) })}>
            {[...new Set([...CTX_CHOICES, s.numCtx])].map((c) => <option key={c} value={c}>{c ? `${c} tokens` : "model default"}</option>)}
          </select>
        </label>
      </div>
      <div className="ui-controls">
        <label className="schedule-toggle">Step speed: {s.stepDelayMs ? `${(s.stepDelayMs / 1000).toFixed(1)} s pause` : "no extra pause"}{" "}
          <input type="range" min={0} max={MAX_DELAY_MS} step={250} value={s.stepDelayMs} disabled={busy} aria-label="Delay between steps" onChange={(e) => void put({ ...s, stepDelayMs: Number(e.target.value) })} />
        </label>
      </div>
      <div className="ui-controls">
        <label className="schedule-toggle">Skill thumbs weight {more.cfg?.weight ?? 2}{" "}
          <input type="range" min={0} max={6} step={0.5} value={more.cfg?.weight ?? 2} disabled={busy} aria-label="Skill thumbs weight" onChange={(e) => void run("set_boost_weight", { weight: Number(e.target.value) }).then(() => more.reload())} />
        </label>
        <ConfirmButton label="Reset skill thumbs" disabled={busy} onConfirm={() => void run("reset_skill_scores").then(() => more.reload())} />
      </div>
      <p className="ui-meta">Applies from the next run. Models run on this PC only (Ollama 127.0.0.1).</p>
    </div>
  );
}
