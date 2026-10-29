import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { ErrorLine } from "../../ui/kit";
import { safeLink } from "../../ui/safeLink";
import { useTask } from "../pccare/useTask";
import { createGist, listGists, type Gist } from "./ghApi";

// Your gists; create one (secret by default). The token needs the `gist` scope.
export function GistSection() {
  const t = useTask<Gist[]>();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [pub, setPub] = useState(false);
  const create = () => t.go(async () => { await createGist(name.trim(), body, pub); setName(""); setBody(""); return listGists(); });
  return (
    <div className="gh-dev">
      <button type="button" className="ui-btn" disabled={t.busy} onClick={() => void t.go(listGists)}>Load gists</button>
      {t.error && <ErrorLine message={t.error} />}
      <ul className="gh-inbox">
        {t.data?.map((g) => (
          <li key={g.id}><button type="button" className="ui-link" onClick={() => { const l = safeLink(g.html_url); if (l) void openUrl(l); }}>{g.description || Object.keys(g.files).join(", ")}</button> <span className="ui-meta">{g.updated_at.slice(0, 10)}</span></li>
        ))}
      </ul>
      <form className="gh-gistform" onSubmit={(e) => { e.preventDefault(); if (name.trim() && body) void create(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="file name, e.g. notes.md" aria-label="Gist file name" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Content" aria-label="Gist content" />
        <label className="ui-meta"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> public</label>
        <button type="submit" className="ui-btn primary" disabled={t.busy || !name.trim() || !body}>Create gist</button>
      </form>
    </div>
  );
}
