// Bookmarks manager (+ Import from Opera) and History, drawn over the page area.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { parseOperaBookmarks } from "./opera";
import { clearHistory, importBookmarks, listHistory, removeBookmark, renameBookmark, type Bookmark, type HistoryRow } from "./store";

type Common = { open(url: string): void; onError(e: unknown): void };

export function BookmarksPage({ marks, reload, open, opera, onError }: Common & { marks: Bookmark[]; reload(): void; opera(url: string): void }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState<{ id: number; title: string; folder: string } | null>(null);
  const importOpera = async () => {
    const files = await invoke<[string, string][]>("opera_bookmarks");
    if (!files.length) return setMsg("No Opera or Opera GX bookmarks file found.");
    let n = 0;
    for (const [name, json] of files) n += await importBookmarks(parseOperaBookmarks(json), `Imported from ${name}`);
    setMsg(`Imported ${n} bookmarks (duplicates skipped).`);
    reload();
  };
  const shown = marks.filter((m) => (m.title + m.url + m.folder).toLowerCase().includes(q.toLowerCase()));
  const folders = [...new Set(shown.map((m) => m.folder))];
  return (
    <div className="br-sheet">
      <div className="br-sheet-head">
        <h3>Bookmarks</h3>
        <input placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter bookmarks" />
        <button className="ui-btn" onClick={() => importOpera().catch(onError)}>Import from Opera</button>
      </div>
      {msg && <p className="ui-meta">{msg}</p>}
      {folders.map((f) => (
        <section key={f}>
          <h4>{f || "Bookmarks bar"}</h4>
          {shown.filter((m) => m.folder === f).map((m) => edit?.id === m.id ? (
            <form key={m.id} className="br-row" onSubmit={(e) => { e.preventDefault(); renameBookmark(m.id, edit.title, edit.folder).then(() => { setEdit(null); reload(); }, onError); }}>
              <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} aria-label="Title" />
              <input value={edit.folder} onChange={(e) => setEdit({ ...edit, folder: e.target.value })} aria-label="Folder" placeholder="Folder" />
              <button className="ui-btn">Save</button>
            </form>
          ) : (
            <div key={m.id} className="br-row">
              <button className="br-link" title={m.url} onClick={() => open(m.url)}>{m.title || m.url}</button>
              <button className="ui-btn" title="Open in Opera / system browser" onClick={() => opera(m.url)}>↗</button>
              <button className="ui-btn" onClick={() => setEdit({ id: m.id, title: m.title, folder: m.folder })}>Edit</button>
              <ConfirmButton label="Delete" onConfirm={() => removeBookmark(m.id).then(reload, onError)} />
            </div>
          ))}
        </section>
      ))}
      {!marks.length && <p className="ui-meta">No bookmarks yet: press ☆ on a page or import from Opera.</p>}
    </div>
  );
}

export function HistoryPage({ open, onError }: Common) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const load = () => listHistory(q).then(setRows).catch(onError);
  useEffect(() => { load(); }, [q]);
  return (
    <div className="br-sheet">
      <div className="br-sheet-head">
        <h3>History</h3>
        <input placeholder="Search history" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search history" />
        <ConfirmButton label="Clear history" onConfirm={() => clearHistory().then(load, onError)} />
      </div>
      <p className="ui-meta">Private tabs are never recorded. Only the newest 2000 visits are kept.</p>
      {rows.map((h) => (
        <div key={h.id} className="br-row">
          <span className="ui-meta">{h.visited.slice(5, 16)}</span>
          <button className="br-link" title={h.url} onClick={() => open(h.url)}>{h.title || h.url}</button>
        </div>
      ))}
    </div>
  );
}
