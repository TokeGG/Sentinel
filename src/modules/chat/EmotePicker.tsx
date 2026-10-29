// Emote picker over the loaded sets (7TV/BTTV/FFZ + channel); inserts the name.
import { useState } from "react";
import { pickEmotes } from "./chatExtras";
import type { EmoteSet } from "./emotes";

export function EmotePicker({ set, onPick }: { set: EmoteSet; onPick(name: string): void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  if (!set.size) return null;
  return (
    <span className="chat-picker">
      <button type="button" className="ui-btn" aria-expanded={open} title="Emotes" onClick={() => setOpen(!open)}>☺</button>
      {open && (
        <div className="chat-picker-pop">
          <input autoFocus placeholder="Search emotes" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chat-picker-grid">
            {pickEmotes(set, q).map((e) => (
              <button key={e.name} type="button" title={e.name} onClick={() => onPick(e.name)}><img src={e.url} alt={e.name} loading="lazy" referrerPolicy="no-referrer" /></button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
