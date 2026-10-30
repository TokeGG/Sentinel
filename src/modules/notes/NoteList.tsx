// Notebook list: full-text search with highlight, folders, tags, archive, new note from a template.
import { notesOptions } from "./panelLogic";
import { useLimit } from "../../ui/useOption";
import { useState, type ReactElement } from "react";
import { Chip } from "../../ui/kit";
import { useStore } from "../../ui/useStore";
import { folderTree, listNotes, noteTitle, tagCounts, type NoteRow } from "./noteLogic";
import { highlight, searchNotes } from "./noteSearch";
import { BUILTIN_TEMPLATES } from "./templates";
import { listTemplates } from "./storeExtra";

function Marked({ text, q }: { text: string; q: string }) {
  return <>{highlight(text, q).map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</>;
}

export function NoteList({ notes, openId, onOpen, onNew }: { notes: NoteRow[]; openId: number | null; onOpen(id: number): void; onNew(body: string, folder: string): void }) {
  const tagMax = useLimit(notesOptions, "tagChips");
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [tag, setTag] = useState("");
  const [archived, setArchived] = useState(false);
  const tpls = useStore(listTemplates, []);
  const all = [...BUILTIN_TEMPLATES, ...tpls.data];
  const folders = folderTree(notes.map((n) => n.folder ?? "").filter(Boolean));
  const shown = listNotes(notes, { folder, tag, archived });
  const hits = q.trim() ? searchNotes(shown, q) : null;
  return (
    <div className="nt-listpane">
      <div className="ui-controls">
        <input type="search" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value="" onChange={(e) => { const t = all.find((x) => String(x.id) === e.target.value); onNew(t ? t.body : "# New note\n", folder); }}>
          <option value="">New note…</option>
          <option value="blank">Blank</option>
          {all.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="ui-chips">
        <Chip on={!folder} onClick={() => setFolder("")}>All</Chip>
        {folders.flatMap(function walk(f): ReactElement[] {
          return [<Chip key={f.path} on={folder === f.path} onClick={() => setFolder(f.path)}>{f.path} · {f.count}</Chip>, ...f.children.flatMap(walk)];
        })}
        <Chip on={archived} onClick={() => setArchived(!archived)}>Archived</Chip>
      </div>
      <div className="ui-chips">
        {tagCounts(notes).slice(0, tagMax).map(([t, n]) => <Chip key={t} on={tag === t} onClick={() => setTag(tag === t ? "" : t)}>#{t} {n}</Chip>)}
      </div>
      <div className="nt-items">
        {(hits ? hits.map((h) => ({ n: h.note, sub: h.snippet })) : shown.map((n) => ({ n, sub: "" }))).map(({ n, sub }) => (
          <button key={n.id} type="button" className={`nt-item${n.id === openId ? " on" : ""}`} onClick={() => onOpen(n.id)}>
            <strong>{n.pinned ? "[pinned] " : ""}<Marked text={noteTitle(n.body)} q={q} /></strong>
            {sub && <span className="ui-meta"><Marked text={sub} q={q} /></span>}
          </button>
        ))}
        {hits && !hits.length && <span className="ui-meta">No matches.</span>}
      </div>
    </div>
  );
}
