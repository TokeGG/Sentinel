// Settings > Knowledge: per-category notes, examples and saved Q&A the panel Ask bars retrieve from (BM25).
import { useEffect, useState } from "react";
import { CATEGORIES, type Category } from "../../core/categories";
import { KB_KINDS, makeEntry, type KbEntry, type KbKind } from "../../core/knowledge/kbLogic";
import { addKb, loadKb, removeKb } from "../../core/knowledge/store";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { Row } from "../../ui/kit";
import { Head } from "./Switch";

export function KnowledgeSection({ onError }: { onError(e: unknown): void }) {
  const [cat, setCat] = useState<Category>("news");
  const [rows, setRows] = useState<KbEntry[]>([]);
  const [kind, setKind] = useState<KbKind>("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const reload = () => loadKb(cat).then(setRows, onError);
  useEffect(() => { void reload(); }, [cat]);
  const add = async () => {
    const e = makeEntry(cat, kind, title, body);
    if (!e.ok) return onError(e.error);
    try { await addKb(e.entry); setTitle(""); setBody(""); await reload(); } catch (err) { onError(err); }
  };
  return (
    <section className="st-section" aria-label="Knowledge">
      <Head>Knowledge</Head>
      <p className="ui-meta">What each category's Ask bar knows: your notes, good answers you marked Good, and lessons from Bad ones. Stays on this PC.</p>
      <Row>
        <label className="st-switch">Category
          <select className="st-input" value={cat} onChange={(e) => setCat(e.target.value as Category)} aria-label="Category">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <small className="ui-meta">{rows.length} entries</small>
      </Row>
      <form className="st-connect" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <Row>
          <select className="st-input" value={kind} onChange={(e) => setKind(e.target.value as KbKind)} aria-label="Kind">
            {KB_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input className="st-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
        </Row>
        <textarea className="st-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Note text, example Q/A, house rules…" aria-label="Text" />
        <button className="ui-btn" disabled={!body.trim()}>Add</button>
      </form>
      {rows.slice(0, 50).map((r) => (
        <div key={r.id} className="st-acct">
          <Row><strong>{r.kind}: {r.title}</strong><ConfirmButton label="Delete" onConfirm={() => void removeKb(r.id!).then(reload, onError)} /></Row>
          <small className="ui-meta">{r.body.slice(0, 200)}</small>
        </div>
      ))}
    </section>
  );
}
