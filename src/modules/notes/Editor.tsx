// Open note: markdown editor + sanitized preview, tags, folder, pin/archive, export, side info.
import { useEffect, useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { exportName, noteMarkdown } from "./exportMd";
import { ExportBar } from "./ExportBar";
import { NoteSide } from "./NoteSide";
import { Preview } from "./Preview";
import { resolveLink, type NoteRow } from "./noteLogic";
import { removeNote, saveNote, setMeta } from "./store";
import { addTemplate } from "./storeExtra";

type Act = <R>(fn: () => Promise<R>) => Promise<R | undefined>;

export function Editor({ note, notes, act, onOpen }: { note: NoteRow; notes: NoteRow[]; act: Act; onOpen(id: number | null): void }) {
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags ?? "");
  const [folder, setFolder] = useState(note.folder ?? "");
  const [mode, setMode] = useState<"edit" | "split" | "preview">("split");
  useEffect(() => { setBody(note.body); setTags(note.tags ?? ""); setFolder(note.folder ?? ""); }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = body !== note.body || tags !== (note.tags ?? "") || folder !== (note.folder ?? "");
  const save = () => act(async () => {
    await saveNote(note.id, body, tags);
    if (folder !== (note.folder ?? "")) await setMeta(note.id, { folder });
  });
  const wiki = (name: string) => { const t = resolveLink(notes, name); if (t) onOpen(t.id); };
  return (
    <div className="nt-editor">
      <div className="ui-controls">
        <button type="button" className="ui-btn primary" disabled={!dirty} onClick={() => void save()}>Save</button>
        {(["edit", "split", "preview"] as const).map((m) => (
          <button key={m} type="button" className={`ui-btn ui-sm${mode === m ? " on" : ""}`} onClick={() => setMode(m)}>{m}</button>
        ))}
        <button type="button" className="ui-btn ui-sm" onClick={() => void act(() => setMeta(note.id, { pinned: !note.pinned }))}>{note.pinned ? "Unpin" : "Pin"}</button>
        <button type="button" className="ui-btn ui-sm" onClick={() => void act(() => setMeta(note.id, { archived: !note.archived }))}>{note.archived ? "Unarchive" : "Archive"}</button>
        <button type="button" className="ui-btn ui-sm" onClick={() => { const n = prompt("Template name"); if (n) void act(() => addTemplate(n, body)); }}>Save as template</button>
        <ExportBar label="Export .md" filename={exportName(note)} text={() => noteMarkdown({ ...note, body })} />
        <ConfirmButton label="Delete" className="ui-btn ui-sm" onConfirm={() => void act(async () => { await removeNote(note.id); onOpen(null); })} />
      </div>
      <div className="ui-controls">
        <input placeholder="Folder, e.g. Work/Projects" value={folder} onChange={(e) => setFolder(e.target.value)} />
        <input placeholder="Tags, e.g. ideas, home" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div className={`nt-panes nt-${mode}`}>
        {mode !== "preview" && (
          <textarea className="nt-text" value={body} spellCheck onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); void save(); } }} />
        )}
        {mode !== "edit" && <Preview body={body} onWiki={wiki} />}
      </div>
      <NoteSide note={note} notes={notes} onOpen={(id) => onOpen(id)} onRestore={setBody} />
    </div>
  );
}
