import { useState } from "react";
import { POST_LIMITS } from "./panelLogic";

/** Inline reply box under a card; keeps the text if sending fails. */
export function ReplyBox({ platform, onSend, onCancel }: { platform: string; onSend: (text: string) => Promise<boolean>; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const max = POST_LIMITS[platform];
  const bad = !text.trim() || (!!max && text.length > max);
  return (
    <form
      className="soc-reply"
      onSubmit={async (e) => {
        e.preventDefault();
        if (bad || sending) return;
        setSending(true);
        const ok = await onSend(text);
        setSending(false);
        if (ok) onCancel();
      }}
    >
      <textarea className="ui-file-text" rows={2} autoFocus value={text} placeholder="Write a reply…" onChange={(e) => setText(e.target.value)} />
      <div className="ui-controls">
        <button type="submit" className="ui-btn" disabled={bad || sending}>{sending ? "Sending…" : "Reply"}</button>
        <button type="button" className="ui-btn" onClick={onCancel}>Cancel</button>
        {max && <span className="ui-meta">{text.length}/{max}</span>}
      </div>
    </form>
  );
}
