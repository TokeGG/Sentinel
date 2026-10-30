import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { getSetting, setSetting } from "../../ui/appSetting";
import { useStore } from "../../ui/useStore";
import { benchmark, deleteModel, listModels, pullModel, unloadModel } from "./ollamaAdmin";
import { fmtSize, pullPct, UNLOAD_GAME_KEY, validModelName } from "./models";

/** Local Ollama models: list, pull with progress, delete (confirm), quick benchmark, unload, game-mode unload toggle. */
export function ModelsPane() {
  const models = useStore(listModels, []);
  const unload = useStore(() => getSetting(UNLOAD_GAME_KEY), null);
  const [name, setName] = useState("");
  const [prog, setProg] = useState("");
  const [bench, setBench] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const wrap = (f: () => Promise<unknown>) => async () => { setErr(""); try { await f(); } catch (e) { setErr(String(e)); } await models.reload(); };
  const pull = wrap(async () => {
    await pullModel(name.trim(), (p) => { const pct = pullPct(p); setProg(`${p.status}${pct !== null ? ` ${pct}%` : ""}`); });
    setProg("done"); setName("");
  });
  return (
    <div className="bot-col">
      {(err || models.error) && <div className="ui-error">{err || models.error}</div>}
      <label><input type="checkbox" checked={unload.data === "1"} onChange={(e) => void unload.act(() => setSetting(UNLOAD_GAME_KEY, e.target.checked ? "1" : "0"))} /> Unload models from memory when game mode starts</label>
      {models.data.map((m) => (
        <div key={m.name} className="bot-row">
          <b>{m.name}</b> <span className="bot-dim">{fmtSize(m.size)}</span> {bench[m.name] && <span className="bot-dim">{bench[m.name]}</span>}
          <button type="button" className="ui-btn ui-sm" onClick={wrap(async () => { setBench({ ...bench, [m.name]: "testing…" }); const b = await benchmark(m.name); setBench((x) => ({ ...x, [m.name]: `${b.tps ?? "?"} tok/s, ${b.secs} s` })); })}>Benchmark</button>
          <button type="button" className="ui-btn ui-sm" onClick={wrap(() => unloadModel(m.name))}>Unload</button>
          <ConfirmButton label="Delete" className="ui-btn ui-sm" onConfirm={wrap(() => deleteModel(m.name))} />
        </div>
      ))}
      {!models.data.length && <span className="bot-dim">No models found (is Ollama running on 127.0.0.1:11434?).</span>}
      <div className="bot-row">
        <input className="ui-input" placeholder="Model to pull, e.g. llama3.1:8b" value={name} onChange={(e) => setName(e.target.value)} aria-label="Model name" />
        <button type="button" className="ui-btn" disabled={!validModelName(name.trim()) || (prog !== "" && prog !== "done")} onClick={() => void pull()}>Pull</button>
        {prog && <span className="bot-dim" aria-live="polite">{prog}</span>}
      </div>
    </div>
  );
}
