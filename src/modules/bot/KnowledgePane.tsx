import { useState } from "react";
import { EmptyState, Row } from "../../ui/kit";
import type { ModuleState } from "../../ui/useModule";
import type { Note } from "./knowledge";
import { noteUrlOk } from "./panelLogic";

export function KnowledgePane({ notes, run, busy, reload }: { notes: Note[]; run: ModuleState["run"]; busy: boolean; reload(): void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const done = async (skill: string, args: Record<string, unknown>, clear: () => void) => { if ((await run(skill, args)) !== undefined) { clear(); reload(); } };
  return (
    <div className="bot-goal">
      <p className="ui-meta">Notes you feed the bot. The most relevant snippets go into its prompt as data, never as instructions.</p>
      <input className="ui-file-text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" aria-label="Note title" />
      <textarea className="ui-file-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a note: how a site works, your preferences, steps that worked..." aria-label="Note text" />
      <div className="ui-actions">
        <button type="button" className="ui-btn" disabled={busy || !text.trim()} onClick={() => void done("add_note", { title, text }, () => { setTitle(""); setText(""); })}>Add note</button>
      </div>
      <div className="ui-quickadd">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://... add a web page as a note" aria-label="Note from address" />
        <button type="button" className="ui-btn" disabled={busy || !noteUrlOk(url)} onClick={() => void done("add_note_url", { url }, () => setUrl(""))}>Fetch and add</button>
      </div>
      {notes.length === 0 ? <EmptyState title="No notes yet" /> : notes.map((n) => (
        <Row key={n.id} end={<button type="button" className="ui-btn" disabled={busy} onClick={() => void done("delete_note", { id: n.id }, () => {})}>Delete</button>}>
          <strong>{n.title}</strong> <span className="ui-meta">{n.source === "text" ? "text" : n.source.slice(0, 60)} - {n.text.length} chars</span>
        </Row>
      ))}
    </div>
  );
}
