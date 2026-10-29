import { useState } from "react";
import { EmptyState, Row } from "../../ui/kit";
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
          {g.items.map((it) => (
            <Row key={it.id} end={
              it.source === "github" && (removing === it.id ? (
                <>
                  <button type="button" className="ui-btn" disabled={busy} onClick={async () => { await run("remove_item", { kind: it.kind, key: it.key }); setRemoving(null); }}>Delete files</button>
                  <button type="button" className="ui-btn" onClick={() => setRemoving(null)}>Keep</button>
                </>
              ) : (
                <>
                  <button type="button" className="ui-btn" disabled={busy} onClick={async () => { const p = (await run("plan_update", { kind: it.kind, key: it.key })) as Plan | undefined; if (p) onPlan(p); }}>Check update</button>
                  <button type="button" className="ui-btn" disabled={busy} onClick={() => setRemoving(it.id)}>Remove</button>
                </>
              ))
            }>
              <label className="sk-toggle">
                <input type="checkbox" checked={it.enabled} disabled={busy} onChange={(e) => void run("set_enabled", { kind: it.kind, key: it.key, source: it.source, enabled: e.target.checked })} />
                <strong>{it.name}</strong>
                <span className="ui-meta">{it.source === "bundled" ? "bundled" : `${it.repo}@${shortSha(it.sha)}`}</span>
              </label>
              <div className="ui-meta sk-desc">{it.description}</div>
              {it.kind === "mcp" && <SecretFields item={it} busy={busy} run={run} />}
            </Row>
          ))}
        </div>
      ))}
    </>
  );
}
