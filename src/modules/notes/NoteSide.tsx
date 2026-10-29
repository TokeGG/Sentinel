// Side info for the open note: backlinks, version history, attachments.
import { useRef } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { humanSize } from "../../ui/kit";
import { useStore } from "../../ui/useStore";
import { backlinks, noteTitle, type NoteRow } from "./noteLogic";
import { addAttachment, deleteAttachment, getAttachmentData, listAttachments, MAX_ATTACH_BYTES } from "./storeExtra";
import { listVersions } from "./store";

export function NoteSide({ note, notes, onOpen, onRestore }: { note: NoteRow; notes: NoteRow[]; onOpen(id: number): void; onRestore(body: string): void }) {
  const files = useStore(() => listAttachments(note.id), []);
  const vers = useStore(() => listVersions(note.id), []);
  const pick = useRef<HTMLInputElement>(null);
  const links = backlinks(notes, note.id);
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_ATTACH_BYTES) return void files.act(async () => { throw new Error(`${f.name} is over ${humanSize(MAX_ATTACH_BYTES)}`); });
    const r = new FileReader();
    r.onload = () => void files.act(() => addAttachment(note.id, f.name, f.type || "application/octet-stream", f.size, String(r.result)));
    r.readAsDataURL(f);
  };
  const download = async (id: number, name: string) => {
    const a = document.createElement("a");
    a.href = await getAttachmentData(id);
    a.download = name;
    a.click();
  };
  return (
    <aside className="nt-side">
      <h4>Backlinks · {links.length}</h4>
      {links.map((n) => <button key={n.id} type="button" className="ui-link" onClick={() => onOpen(n.id)}>{noteTitle(n.body)}</button>)}
      {!links.length && <span className="ui-meta">No note links here with [[{noteTitle(note.body)}]].</span>}
      <h4>Attachments · {files.data.length}</h4>
      {files.error && <span className="ui-meta" role="alert">{files.error}</span>}
      {files.data.map((f) => (
        <span key={f.id} className="nt-att">
          <button type="button" className="ui-link" onClick={() => void download(f.id, f.name)} title="Save a copy">{f.name}</button>
          <span className="ui-meta">{humanSize(f.size)}</span>
          <ConfirmButton label="x" className="ui-btn ui-sm" onConfirm={() => void files.act(() => deleteAttachment(f.id))} />
        </span>
      ))}
      <input ref={pick} type="file" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <button type="button" className="ui-btn ui-sm" onClick={() => pick.current?.click()}>Attach file (max {humanSize(MAX_ATTACH_BYTES)})</button>
      <h4>Versions · {vers.data.length}</h4>
      {vers.data.map((v) => (
        <span key={v.id} className="nt-att">
          <span className="ui-meta">{v.saved_at}</span>
          <button type="button" className="ui-btn ui-sm" onClick={() => onRestore(v.body)} title="Loads this text into the editor; Save keeps it">Restore</button>
        </span>
      ))}
    </aside>
  );
}
