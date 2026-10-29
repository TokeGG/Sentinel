import { memo } from "react";
import { tokenize, type EmoteSet } from "./emotes";
import { badgeLabel, clock } from "./panelLogic";
import type { Message } from "./types";

const HEX = /^#[0-9a-f]{6}$/i;

export const MessageRow = memo(function MessageRow({ m, set, stamp, mention }: { m: Message; set: EmoteSet; stamp: boolean; mention: boolean }) {
  const segs = tokenize(m.text, m.native ?? [], set);
  const body = segs.map((s, i) =>
    s.t === "text" ? (
      <span key={i}>{s.text}</span>
    ) : (
      <img key={i} className={`chat-emote${s.zeroWidth ? " zw" : ""}`} src={s.url} alt={s.name} title={s.name} loading="lazy" referrerPolicy="no-referrer" />
    )
  );
  if (m.kind === "notice") return <div className="chat-row chat-notice">{stamp && <time>{clock(m.time)}</time>}{body}</div>;
  return (
    <div className={`chat-row${mention ? " chat-mention" : ""}${m.deleted ? " chat-deleted" : ""}${m.self ? " chat-self" : ""}`}>
      {stamp && <time>{clock(m.time)}</time>}
      {(m.badges ?? []).map((b, i) => badgeLabel(b) && <span key={i} className="chat-badge" data-b={b} title={b}>{badgeLabel(b)}</span>)}
      <b className="chat-user" style={m.color && HEX.test(m.color) ? { color: m.color } : undefined}>{m.user}</b>
      <span>{m.kind === "action" ? " " : ": "}</span>
      <span className={m.kind === "action" ? "chat-action" : undefined}>{body}</span>
    </div>
  );
});
