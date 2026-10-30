import { useState } from "react";
import type { ModuleState } from "../../ui/useModule";
import { importPreview, parseRecipe } from "./recipe";
import type { SiteNote } from "./siteNotes";
import type { Workflow } from "./workflow";

/** Recipes: export a workflow + its sites' notes as JSON; import = paste or open a file, check, preview, then Apply. */
export function RecipeBox({ list, sites, run, busy, reload }: { list: Workflow[]; sites: SiteNote[]; run: ModuleState["run"]; busy: boolean; reload(): void }) {
  const [sel, setSel] = useState("");
  const [out, setOut] = useState("");
  const [text, setText] = useState("");
  const [applied, setApplied] = useState(false);
  const p = text.trim() ? parseRecipe(text) : null;
  const exp = async () => { const r = (await run("export_recipe", { id: Number(sel) })) as { text: string; saved: string | null } | undefined; if (r) setOut(r.saved ? `Saved to ${r.saved}` : r.text); };
  const file = async (f: File | undefined) => { if (f) { setApplied(false); setText((await f.text()).slice(0, 600_000)); } };
  return (
    <div className="bot-goal">
      <h4 className="ui-meta">Recipes (share a workflow with its site notes)</h4>
      <div className="ui-quickadd">
        <select className="ui-select" value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Workflow to export">
          <option value="">Workflow to export...</option>
          {list.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button type="button" className="ui-btn" disabled={busy || !sel} onClick={() => void exp()}>Export</button>
      </div>
      {out && <textarea className="ui-file-text" rows={3} readOnly value={out} aria-label="Exported recipe" />}
      <textarea className="ui-file-text" rows={3} value={text} onChange={(e) => { setApplied(false); setText(e.target.value); }} placeholder="Paste a recipe (.bot.json) to import" aria-label="Recipe to import" />
      <input type="file" accept=".json,application/json" aria-label="Open recipe file" onChange={(e) => void file(e.target.files?.[0])} />
      {p && !p.ok && <p className="ui-meta" role="alert">Not imported: {p.error}</p>}
      {p?.ok && (
        <div role="status">
          <ul className="bot-steps">{importPreview(p.recipe, list.map((w) => w.name), sites).concat(p.warnings).map((l, i) => <li key={i}>{l}</li>)}</ul>
          <button type="button" className="ui-btn primary" disabled={busy || applied} onClick={async () => { if ((await run("import_recipe", { text })) !== undefined) { setApplied(true); reload(); } }}>{applied ? "Imported" : "Apply"}</button>
        </div>
      )}
    </div>
  );
}
