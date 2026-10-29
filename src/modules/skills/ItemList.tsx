import { useState } from "react";
import { EmptyState } from "../../ui/kit";
import type { ModuleState } from "../../ui/useModule";
import type { Plan } from "./install";
import { groupByBundle, shortSha, type Item } from "./panelLogic";
import { SecretFields } from "./SecretFields";

export function ItemList({ items, busy, run, onPlan, empty }: { items: Item[]; busy: boolean; run: ModuleState["run"]; onPlan(p: Plan): void; empty: string }) {
  const [removing, setRemoving] = useState<string | null>(null);
  if (!items.length) return <EmptyState title={empty} hint="Install one from GitHub below." />;
  return (
    <>
      {groupByBundle(items).map((g) => (
        <div key={g.bundle} className="sk-group">
          <h4 className="sk-bundle">{g.label}</h4>
          <div className="sk-cards">
          {g.items.map((it) => (
            <div key={it.id} className={`sk-card${it.enabled ? " on" : ""}`}>
              <label className="sk-toggle">
                <input type="checkbox" checked={it.enabled} disabled={busy} onChange={(e) => void run("set_enabled", { kind: it.kind, key: it.key, source: it.source, enabled: e.target.checked })} />
                <strong>{it.name}</strong>
              </label>
              <span className="sk-src">{it.source === "bundled" ? "bundled" : `${it.repo}@${shortSha(it.sha)}`}</span>
              <div className="sk-desc">{it.description}</div>
              {it.kind === "mcp" && <SecretFields item={it} busy={busy} run={run} />}
              {it.source === "github" && (
                <div className="sk-acts">
                  {removing === it.id ? (
                    <>
                      <button type="button" className="ui-btn sm danger" disabled={busy} onClick={async () => { await run("remove_item", { kind: it.kind, key: it.key }); setRemoving(null); }}>Delete files</button>
                      <button type="button" className="ui-btn sm" onClick={() => setRemoving(null)}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="ui-btn sm" disabled={busy} onClick={async () => { const p = (await run("plan_update", { kind: it.kind, key: it.key })) as Plan | undefined; if (p) onPlan(p); }}>Check update</button>
                      <button type="button" className="ui-btn sm" disabled={busy} onClick={() => setRemoving(it.id)}>Remove</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      ))}
    </>
  );
}
