// Pick the local Ollama model (saved as app_settings `local_model`). No inference happens here.
import { useState } from "react";
import type { LocalModel } from "./localModel";
import type { ModuleState } from "../../ui/useModule";

export function ModelPane({ busy, run }: { busy: boolean; run: ModuleState["run"] }) {
  const [list, setList] = useState<{ models: LocalModel[]; current: string } | null>(null);
  const [saved, setSaved] = useState("");
  const current = saved || list?.current || "";
  return (
    <div className="ui-controls">
      <button type="button" className="ui-btn" disabled={busy} onClick={async () => { const r = (await run("list_models")) as typeof list | undefined; if (r) setList(r); }}>
        Find models on this PC
      </button>
      {list && (list.models.length === 0 ? <span className="ui-meta">Ollama has no models yet.</span> : (
        <select className="ui-select" value={current} aria-label="Local model" onChange={async (e) => { if ((await run("save_model", { name: e.target.value })) !== undefined) setSaved(e.target.value); }}>
          <option value="">(none chosen)</option>
          {list.models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
      ))}
      <span className="ui-meta">{current ? `Chosen: ${current}` : "Looks at 127.0.0.1:11434 only."}</span>
    </div>
  );
}
