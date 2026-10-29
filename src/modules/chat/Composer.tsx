import { useState } from "react";
import type { RoomLive } from "./useRoom";
import type { EmoteSet } from "./emotes";
import { EmotePicker } from "./EmotePicker";
import { insertEmote } from "./chatExtras";

// Send box. Read-only connections show the connector's honest reason instead.
export function Composer({ live, set }: { live: RoomLive; set: EmoteSet }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const send = live.link?.send;
  if (!live.link) return null;
  if (!send) return <div className="chat-note">{live.link.note ?? "Read-only."}</div>;
  return (
    <form
      className="chat-composer"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        try {
          await send(t);
          setText("");
          setErr(null);
        } catch (x) {
          setErr(x instanceof Error ? x.message : String(x));
        }
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Send as ${live.link.nick ?? "you"}…`} maxLength={500} />
      <EmotePicker set={set} onPick={(n) => setText((t) => insertEmote(t, n))} />
      <button type="submit" className="ui-btn primary" disabled={!text.trim()}>Send</button>
      {err && <span className="chat-err">{err}</span>}
    </form>
  );
}
