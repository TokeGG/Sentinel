// Attachment list: Save (save dialog -> Rust writes the one file) and Preview for
// images / PDF / text. Image and PDF bytes are shown from a data: URL inside a
// sandbox="" iframe (no scripts); text is decoded into a <pre>. SVG/HTML never preview.
import { useState } from "react";
import { errorText } from "../../ui/moduleRun";
import { decodeText, previewKind } from "./mailExtras";
import { fetchAttachment, saveAttachment, type AttachData } from "./extrasSync";
import { sizeLabel } from "./panelLogic";
import type { Account, Body, Msg } from "./types";

export function Attachments({ account, msg, body }: { account: Account | undefined; msg: Msg; body: Body }) {
  const [view, setView] = useState<(AttachData & { i: number }) | null>(null);
  const [note, setNote] = useState("");
  if (!body.attachments.length || !account) return null;
  const run = async (f: () => Promise<unknown>) => { setNote("Working…"); try { await f(); setNote(""); } catch (e) { setNote(errorText(e)); } };
  const kind = view ? previewKind(view.mime, view.name) : "none";
  const src = view ? `data:${kind === "pdf" ? "application/pdf" : view.mime};base64,${view.data}` : "";
  return (
    <div className="mail-att">
      <ul>{body.attachments.map((a, i) => (
        <li key={i}>📎 {a.name} <small>{a.mime} · {sizeLabel(a.size)}</small>
          <button type="button" className="ui-link" onClick={() => void run(async () => { if (await saveAttachment(account, msg, i, a.name)) setNote(`Saved ${a.name}`); })}>Save…</button>
          {previewKind(a.mime, a.name) !== "none" && <button type="button" className="ui-link" onClick={() => void run(async () => setView({ ...(await fetchAttachment(account, msg, i)), i }))}>Preview</button>}
        </li>
      ))}</ul>
      {note && <div className="mail-note">{note}</div>}
      {view && (
        <div className="mail-preview">
          <div className="mail-row"><b>{view.name}</b><button type="button" className="ui-link" onClick={() => setView(null)}>Close preview</button></div>
          {kind === "text" ? <pre className="mail-text">{decodeText(view.data).slice(0, 200000)}</pre>
            : kind === "image" ? <img alt={view.name} src={src} />
            : kind === "pdf" ? <iframe title={view.name} sandbox="" src={src} />
            : <div className="mail-note">No preview for this type.</div>}
        </div>
      )}
    </div>
  );
}
