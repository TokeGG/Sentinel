import { useState } from "react";
import type { Draft } from "./composeLogic";
import { applySuggestion, suggest } from "./mailExtras";

type Pool = { name: string; address: string }[];

function AddrInput({ placeholder, value, pool, onChange }: { placeholder: string; value: string; pool: Pool; onChange: (v: string) => void }) {
  const [focus, setFocus] = useState(false);
  const list = focus ? suggest(value, pool) : [];
  return (
    <div className="mail-ac">
      <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} />
      {list.length > 0 && <ul className="mail-menu">{list.map((s) => <li key={s}><button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(applySuggestion(value, s)); }}>{s}</button></li>)}</ul>}
    </div>
  );
}

export function Compose({ from, draft, busy, pool, onChange, onSend, onClose, onDiscard, onServer }: {
  from: string; draft: Draft; busy: boolean; pool: Pool; onChange: (d: Draft) => void; onSend: () => void;
  onClose: () => void; onDiscard: () => void; onServer: () => void;
}) {
  const [more, setMore] = useState(!!draft.cc || !!draft.bcc);
  const set = (k: keyof Draft, v: string) => onChange({ ...draft, [k]: v });
  return (
    <form className="mail-compose" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
      <div className="mail-compose-head"><b>New message</b><span className="mail-note">from {from} · draft autosaved</span><button type="button" className="ui-link" aria-label="Close compose (keep draft)" title="Close (draft kept)" onClick={onClose}>✕</button></div>
      <AddrInput placeholder="To (comma separated)" value={draft.to} pool={pool} onChange={(v) => set("to", v)} />
      {more ? (
        <>
          <AddrInput placeholder="Cc" value={draft.cc} pool={pool} onChange={(v) => set("cc", v)} />
          <AddrInput placeholder="Bcc" value={draft.bcc} pool={pool} onChange={(v) => set("bcc", v)} />
        </>
      ) : <button type="button" className="ui-link" onClick={() => setMore(true)}>Add Cc / Bcc</button>}
      <input placeholder="Subject" value={draft.subject} onChange={(e) => set("subject", e.target.value)} />
      <textarea rows={9} placeholder="Message (plain text)" value={draft.body} onChange={(e) => set("body", e.target.value)} />
      <div className="mail-row">
        <button type="submit" className="ui-btn primary" disabled={busy}>{busy ? "Sending…" : "Send"}</button>
        <button type="button" className="ui-btn" disabled={busy} onClick={onServer} title="IMAP APPEND to the account's Drafts folder">Save to server</button>
        <button type="button" className="ui-btn" onClick={onDiscard}>Discard</button>
      </div>
    </form>
  );
}
