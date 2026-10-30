import { useState } from "react";
import type { ModuleState } from "../../ui/useModule";
import { CATEGORIES } from "../../core/categories";
import { checkDraft } from "./skillDraft";

/** Describe a task -> the local model drafts SKILL.md -> edit -> Preview (parsed + checks) -> Save. */
export function SkillBuilder({ busy, run, refresh }: { busy: boolean; run: ModuleState["run"]; refresh(): void }) {
  const [task, setTask] = useState("");
  const [cat, setCat] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(false);
  const [replace, setReplace] = useState(false);
  const [saved, setSaved] = useState("");
  const c = text ? checkDraft(text, []) : null;
  const draft = async () => {
    const r = (await run("draft_skill", { task, category: cat })) as { text: string } | undefined;
    if (r) { setText(r.text); setPreview(false); setSaved(""); }
  };
  const save = async () => {
    const r = (await run("save_local_skill", { text, overwrite: replace })) as { id: string } | undefined;
    if (r) { setSaved(`Saved as ${r.id} (enabled; switch it off in Skills any time).`); setPreview(false); refresh(); }
  };
  return (
    <div className="ui-controls" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <textarea className="ui-file-text" rows={2} value={task} onChange={(e) => setTask(e.target.value)} placeholder="Describe the task, e.g. compare two laptops from their spec pages" aria-label="Task for the new skill" />
      <div className="ui-controls">
        <select className="ui-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">Category: let the model choose</option>
          {CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <button type="button" className="ui-btn primary" disabled={busy || !task.trim()} onClick={() => void draft()}>Draft with local model</button>
        <button type="button" className="ui-btn" disabled={busy} onClick={() => { setText("---\nname: my-skill\ndescription: What it does and when to use it.\ncategory: productivity\n---\n\n# My skill\n\n1. First step.\n"); setPreview(false); }}>Start blank</button>
      </div>
      {text && <textarea className="ui-file-text" rows={12} value={text} onChange={(e) => { setText(e.target.value); setPreview(false); }} aria-label="SKILL.md" spellCheck={false} />}
      {text && <div className="ui-controls">
        <button type="button" className="ui-btn" onClick={() => setPreview(true)}>Preview</button>
        <label className="schedule-toggle"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace my local skill of the same name</label>
      </div>}
      {preview && c && (c.ok ? (
        <div role="status">
          <p><strong>{c.skill.name}</strong>: {c.skill.description}</p>
          <p className="ui-meta">Category: {c.skill.meta.category || "(none)"}. Will be written to the app skills folder as {c.id}/SKILL.md.</p>
          {c.warnings.map((w) => <p key={w} className="ui-meta">Note: {w}</p>)}
          <pre className="sk-pre">{c.skill.body.slice(0, 3000)}</pre>
          <button type="button" className="ui-btn primary" disabled={busy} onClick={() => void save()}>Save skill</button>
        </div>
      ) : <p className="ui-meta" role="alert">Cannot save yet: {c.error}</p>)}
      {saved && <p className="ui-meta" role="status">{saved}</p>}
    </div>
  );
}
