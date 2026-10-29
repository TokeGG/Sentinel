import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { ErrorLine, Spark } from "../../ui/kit";
import { useTask } from "../pccare/useTask";
import { listClones, openClone, projectInfo, type Clone } from "./clones";
import { parseStatus, readmePrompt, statusText } from "./devLogic";
import { commitStats, draftReadme } from "./ghApi";

interface Hit { file: string; line: number; rule: string; preview: string }

// Per cloned repo: git status, open in terminal, secret scan (redacted), commit chart, README draft (local model).
export function ProjectTools() {
  const [clones, setClones] = useState<Clone[]>([]);
  const [id, setId] = useState(0);
  const out = useTask<string>();
  const sec = useTask<Hit[]>();
  const st = useTask<number[]>();
  const [draft, setDraft] = useState("");
  useEffect(() => { listClones().then((c) => { setClones(c); setId(c[0]?.id ?? 0); }).catch(() => setClones([])); }, []);
  const c = clones.find((x) => x.id === id);
  if (!clones.length) return <div className="ui-meta">Clone a repo first; tools for it appear here.</div>;
  const readme = () => out.go(async () => { const i = await projectInfo(c!.local_path); const d = await draftReadme(readmePrompt(c!.full_name, i.markers, i.package_json ?? null)); setDraft(d); return "README draft ready (not saved)"; });
  return (
    <div className="gh-dev">
      <div className="ui-actions">
        <select className="ui-select" value={id} onChange={(e) => setId(Number(e.target.value))} aria-label="Cloned repo">
          {clones.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
        </select>
        <button type="button" className="ui-btn" disabled={!c || out.busy} onClick={() => void out.go(async () => statusText(parseStatus(await invoke<string>("git_status", { path: c!.local_path }))))}>Git status</button>
        <button type="button" className="ui-btn" disabled={!c} onClick={() => void openClone(c!, "terminal")}>Terminal</button>
        <button type="button" className="ui-btn" disabled={!c || sec.busy} onClick={() => void sec.go(() => invoke<Hit[]>("scan_secrets", { path: c!.local_path }))}>Scan for secrets</button>
        <button type="button" className="ui-btn" disabled={!c || st.busy} onClick={() => void st.go(() => commitStats(c!.full_name))}>Commit stats</button>
        <button type="button" className="ui-btn" disabled={!c || out.busy} onClick={() => void readme()}>Draft README (local model)</button>
      </div>
      {(out.error || sec.error || st.error) && <ErrorLine message={String(out.error ?? sec.error ?? st.error)} />}
      {out.data && <div className="ui-meta">{out.data}</div>}
      {st.data && (st.data.length ? <div className="ui-meta"><Spark points={st.data} tone="up" /> {st.data.reduce((a, b) => a + b, 0)} commits in 52 weeks</div> : <div className="ui-meta">GitHub is still computing stats; try again shortly.</div>)}
      {sec.data && (
        <ul className="gh-inbox">
          {sec.data.map((h, i) => <li key={i}><b>{h.rule}</b> {h.file}:{h.line} <code>{h.preview}</code></li>)}
          {!sec.data.length && <li className="ui-meta">No known secret patterns found.</li>}
        </ul>
      )}
      {draft && <textarea className="gh-readme" value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} aria-label="README draft" />}
    </div>
  );
}
