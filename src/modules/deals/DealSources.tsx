// Source list: enable toggle + category per feed (the preloaded ones and your own).
import { useEffect, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { findSkill } from "../../ui/moduleRun";
import type { ModuleState } from "../../ui/useModule";
import { CATEGORIES } from "./defaults";
import type { DealSource } from "./store";

export function DealSources({ module, run, busy, version }: { module: ModuleManifest; run: ModuleState["run"]; busy: boolean; version: unknown }) {
  const [list, setList] = useState<DealSource[]>([]);
  useEffect(() => {
    let live = true;
    findSkill(module, "deal_sources").run().then((r) => live && setList(r as DealSource[]), () => {});
    return () => void (live = false);
  }, [module, version]);
  if (!list.length) return null;
  const on = list.filter((s) => s.enabled).length;
  return (
    <details className="dl-sources">
      <summary>Sources ({on}/{list.length} on)</summary>
      {list.map((s) => (
        <div key={s.id} className="dl-src">
          <label>
            <input type="checkbox" checked={!!s.enabled} disabled={busy} onChange={(e) => void run("set_source", { id: s.id, enabled: e.target.checked })} />
            {" "}{s.label || s.url}
          </label>
          <select className="ui-select" aria-label={`Category of ${s.label || s.url}`} value={s.category} disabled={busy} onChange={(e) => void run("set_source", { id: s.id, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      ))}
    </details>
  );
}
