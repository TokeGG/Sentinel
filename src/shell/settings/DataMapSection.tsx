// Settings > Data map: what each module stores, per-module export / reset / wipe (preview + confirm),
// and "Where is my data" (Sentinel's folders).
import { useEffect, useState } from "react";
import { Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { Head } from "./Switch";
import { MODULE_DATA, unmapped, type ModuleData, type WipeStep } from "../privacy/dataMap";
import { allTables, applySteps, dataPaths, exportModule, inventory, resetSteps, wipeSteps, type ModuleInventory } from "../privacy/dataOps";

function ModuleRow({ m, all, onError }: { m: ModuleData; all: string[]; onError(e: unknown): void }) {
  const [inv, setInv] = useState<ModuleInventory | null>(null);
  const [plan, setPlan] = useState<{ kind: "wipe" | "reset"; steps: WipeStep[] } | null>(null);
  const [msg, setMsg] = useState("");
  const load = () => inventory(m, all).then(setInv).catch(onError);
  const run = async () => {
    if (!plan) return;
    try { await applySteps(m, plan.steps, plan.kind === "wipe" ? "wipe_module" : "reset_module"); setMsg(plan.kind === "wipe" ? "Wiped" : "Reset to defaults"); setPlan(null); await load(); }
    catch (e) { onError(e); }
  };
  return (
    <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !inv) void load(); }}>
      <summary>{m.name}</summary>
      {inv && <>
        <Row><small className="ui-meta">Tables: {inv.tables.map((t) => `${t.name} (${t.rows})`).join(", ") || "none"}</small></Row>
        <Row><small className="ui-meta">Settings keys: {inv.keys.join(", ") || "none"}</small></Row>
        <Row>
          <button className="ui-btn ui-sm" onClick={() => exportModule(m, inv).then((ok) => ok && setMsg("Exported")).catch(onError)}>Export JSON…</button>
          <button className="ui-btn ui-sm" onClick={() => setPlan({ kind: "reset", steps: resetSteps(m, inv) })}>Reset to defaults…</button>
          <button className="ui-btn ui-sm" onClick={() => setPlan({ kind: "wipe", steps: wipeSteps(m, inv) })}>Wipe data…</button>
          {msg && <span className="ui-meta" role="status">{msg}</span>}
        </Row>
      </>}
      {plan && (
        <div className="ui-banner" role="dialog" aria-label="Preview">
          <strong>{plan.kind === "wipe" ? "This deletes:" : "This forgets (data is kept):"}</strong>
          <ul>{plan.steps.map((s, i) => <li key={i} className="ui-meta">{s.label}</li>)}</ul>
          <ConfirmButton label={plan.kind === "wipe" ? "Wipe" : "Reset"} onConfirm={() => void run()} />
          <button className="ui-btn" onClick={() => setPlan(null)}>Cancel</button>
        </div>
      )}
    </details>
  );
}

export function DataMapSection({ onError }: { onError(e: unknown): void }) {
  const [all, setAll] = useState<string[] | null>(null);
  const [paths, setPaths] = useState<{ label: string; path: string }[]>([]);
  useEffect(() => { allTables().then(setAll).catch(onError); dataPaths().then(setPaths).catch(() => setPaths([])); }, []);
  return (
    <section className="st-section" aria-label="Data map">
      <Head>Data map</Head>
      <Row><small className="ui-meta">What each module keeps in the local database. Secrets are only in the Windows Credential Manager and are never listed or exported here.</small></Row>
      {all && MODULE_DATA.map((m) => <ModuleRow key={m.id} m={m} all={all} onError={onError} />)}
      {all && <Row><small className="ui-meta">Not mapped to a module: {unmapped(all).join(", ") || "none"}</small></Row>}
      <Head>Where is my data</Head>
      {paths.length === 0 && <Row><small className="ui-meta">Folder list not available.</small></Row>}
      {paths.map((p) => (
        <Row key={p.label}><span>{p.label}</span>
          <code className="ui-meta" style={{ userSelect: "all" }}>{p.path}</code>
          <button className="ui-btn ui-sm" onClick={() => navigator.clipboard.writeText(p.path).catch(onError)}>Copy</button></Row>
      ))}
    </section>
  );
}
