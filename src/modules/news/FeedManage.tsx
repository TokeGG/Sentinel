// Remove a feed (and its items) or clear old items; both behind a confirm step.
import { useEffect, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { findSkill } from "../../ui/moduleRun";
import type { ModuleState } from "../../ui/useModule";
import { feedChoiceLabel, type FeedSource } from "./panelLogic";

export function FeedManage({ module, busy, run, version }: { module: ModuleManifest; busy: boolean; run: ModuleState["run"]; version: unknown }) {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [pick, setPick] = useState("");
  useEffect(() => {
    let live = true;
    findSkill(module, "list_sources").run().then((r) => live && setSources(r as FeedSource[]), () => {});
    return () => void (live = false);
  }, [module, version]);
  const sel = sources.find((s) => String(s.id) === pick) ?? sources[0];
  return (
    <div className="ui-controls feed-manage">
      {sel && (
        <>
          <select className="ui-select" aria-label="Feed" value={String(sel.id)} onChange={(e) => setPick(e.target.value)} disabled={busy}>
            {sources.map((s) => <option key={s.id} value={String(s.id)}>{feedChoiceLabel(s)}</option>)}
          </select>
          <ConfirmButton label="Remove feed" disabled={busy} title="Removes the feed and its stored items" onConfirm={() => void run("remove_source", { id: sel.id })} />
        </>
      )}
      <ConfirmButton label="Clear older than 30 days" disabled={busy} onConfirm={() => void run("clear_items", { days: 30 })} />
      <ConfirmButton label="Clear all items" disabled={busy} title="Items still listed by a feed return on the next fetch" onConfirm={() => void run("clear_items", { days: 0 })} />
    </div>
  );
}
