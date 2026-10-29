import { useState } from "react";
import type { Draft } from "./composeLogic";

export function Compose({ from, draft, busy, onChange, onSend, onClose }: {
  from: string; draft: Draft; busy: boolean; onChange: (d: Draft) => void; onSend: () => void; onClose: () => void;
}) {
  const [more, setMore] = useState(!!draft.cc || !!draft.bcc);
  const set = (k: keyof Draft, v: string) => onChange({ ...draft, [k]: v });
  return (
    <form className="mail-compose" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
      <div className="mail-note">From {from}</div>
      <input placeholder="To (comma separated)" value={draft.to} onChange={(e) => set("to", e.target.value)} />
      {more ? (
        <>
          <input placeholder="Cc" value={draft.cc} onChange={(e) => set("cc", e.target.value)} />
          <input placeholder="Bcc" value={draft.bcc} onChange={(e) => set("bcc", e.target.value)} />
        </>
      ) : <button type="button" className="ui-link" onClick={() => setMore(true)}>Add Cc / Bcc</button>}
      <input placeholder="Subject" value={draft.subject} onChange={(e) => set("subject", e.target.value)} />
      <textarea rows={10} placeholder="Message (plain text)" value={draft.body} onChange={(e) => set("body", e.target.value)} />
      <div className="mail-row">
        <button type="submit" className="ui-btn primary" disabled={busy}>{busy ? "Sending…" : "Send"}</button>
        <button type="button" className="ui-btn" onClick={onClose}>Discard</button>
      </div>
    </form>
  );
}
