// Deal source list: the generic curated-source list (category/store filter, enable, remove, Check sources).
import { useMemo } from "react";
import type { ModuleManifest } from "../../core/module";
import { findSkill } from "../../ui/moduleRun";
import { mergeRows } from "../news/sources/logic";
import { SourceList, type SourceApi } from "../news/sources/SourceList";
import { checkSources, loadState } from "../news/sources/store";
import { CATEGORIES } from "./defaults";
import { listDealSources } from "./store";

export function DealSources({ module, busy, version }: { module: ModuleManifest; busy: boolean; version: unknown }) {
  const api = useMemo<SourceApi>(() => ({
    list: async () => mergeRows(await listDealSources(), await loadState("deals")),
    setEnabled: (r, on) => findSkill(module, "set_source").run({ id: r.id, enabled: on }),
    remove: (r) => findSkill(module, "remove_source").run({ id: r.id }),
    check: (urls) => checkSources("deals", urls),
  }), [module]);
  return (
    <details className="dl-sources">
      <summary>Sources</summary>
      <SourceList api={api} categories={[...CATEGORIES]} busy={busy} version={version} />
    </details>
  );
}
