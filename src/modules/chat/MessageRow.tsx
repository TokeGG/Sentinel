import { memo } from "react";
import { tokenize, type EmoteSet } from "./emotes";
import { badgeLabel, clock } from "./panelLogic";
import type { Message } from "./types";
import type { UserPref } from "./chatExtras";

const HEX = /^#[0-9a-f]{6}$/i;

export const MessageRow = memo(function MessageRow({ m, set, stamp, mention, pref, onUser }: {
  m: Message; set: EmoteSet; stamp: boolean; mention: boolean; pref?: UserPref; onUser?: (user: string) => void;
}) {
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
      <b className="chat-user" role="button" tabIndex={0} title={pref?.nick ? m.user : "Nickname, colour, ignore"} onClick={() => onUser?.(m.user)}
        style={pref?.color && HEX.test(pref.color) ? { color: pref.color } : m.color && HEX.test(m.color) ? { color: m.color } : undefined}>{pref?.nick || m.user}</b>
      <span>{m.kind === "action" ? " " : ": "}</span>
      <span className={m.kind === "action" ? "chat-action" : undefined}>{body}</span>
    </div>
  );
});
