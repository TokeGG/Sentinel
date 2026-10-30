// Settings > Knowledge: import course notes (.txt/.md file, or text copied from a PDF) as chunked entries.
import { useState } from "react";
import type { Category } from "../../core/categories";
import { chunkText } from "../../core/knowledge/importText";
import { makeEntry } from "../../core/knowledge/kbLogic";
import { addKb } from "../../core/knowledge/store";

export function KnowledgeImport({ cat, onDone, onError }: { cat: Category; onDone(): void; onError(e: unknown): void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parts = chunkText(text, title);
  const run = async () => {
    setBusy(true);
    try {
      for (const p of parts) { const e = makeEntry(cat, "note", p.title, p.body); if (!e.ok) throw new Error(e.error); await addKb(e.entry); }
      setText(""); setTitle(""); onDone();
    } catch (e) { onError(e); }
    setBusy(false);
  };
  return (
    <details className="st-connect">
      <summary>Import course notes</summary>
      <p className="ui-meta">Pick a .txt or .md file, or paste text copied from a PDF. It is split into notes for the "{cat}" category.</p>
      <input type="file" accept=".txt,.md,text/plain,text/markdown" aria-label="Notes file"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (!title) setTitle(f.name.replace(/\.\w+$/, "")); void f.text().then(setText, onError); } }} />
      <input className="st-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Import title" />
      <textarea className="st-input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste notes or PDF text" aria-label="Import text" />
      <button type="button" className="ui-btn" disabled={busy || !parts.length} onClick={() => void run()}>Import {parts.length} note(s)</button>
    </details>
  );
}
