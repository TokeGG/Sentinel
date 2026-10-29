import { useState } from "react";
import { composeError, POST_LIMITS } from "./panelLogic";
import type { Status } from "./Accounts";

export function Composer({ status, busy, onPost }: { status: Status[]; busy: boolean; onPost: (text: string, targets: string[]) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [off, setOff] = useState<string[]>([]);
  const can = status.filter((s) => s.connected && s.canPost);
  const readOnly = status.filter((s) => s.connected && !s.canPost).map((s) => s.label);
  const targets = can.map((s) => s.id).filter((id) => !off.includes(id));
  const err = composeError(text, targets);
  const limit = Math.min(...targets.map((t) => POST_LIMITS[t] ?? Infinity));
  return (
    <form
      className="soc-composer"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!err && (await onPost(text, targets))) setText("");
      }}
    >
      <span className="soc-avatar soc-me" aria-hidden>✎</span>
      <div className="soc-compose-main">
      <textarea value={text} rows={2} placeholder={can.length ? "What's happening?" : "Connect Bluesky or Mastodon under Accounts to post"} onChange={(e) => setText(e.target.value)} />
      <div className="ui-controls">
        {can.map((s) => (
          <label key={s.id} className="soc-target">
            <input type="checkbox" checked={!off.includes(s.id)} onChange={() => setOff((o) => (o.includes(s.id) ? o.filter((x) => x !== s.id) : [...o, s.id]))} />
            {s.label}
          </label>
        ))}
        {Number.isFinite(limit) && <span className="ui-meta soc-count">{text.length}/{limit}</span>}
        <button type="submit" className="ui-btn primary" disabled={busy || !!err} title={err ?? undefined}>Post</button>
      </div>
      {readOnly.length > 0 && <span className="ui-meta">Read-only here: {readOnly.join(", ")}</span>}
      </div>
    </form>
  );
}
