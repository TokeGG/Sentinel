import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { connectorOf } from "./connectors";
import { Composer } from "./Composer";
import { EmbedView } from "./EmbedView";
import { MessageRow } from "./MessageRow";
import { isAtBottom, isMention } from "./panelLogic";
import { ConnPanel } from "./ConnPanel";
import type { Room, RoomState } from "./types";
import { useEmoteSets } from "./useEmoteSets";
import { useRoom } from "./useRoom";
import { classify, playerEmbed, userKey } from "./chatExtras";
import { usePrefs } from "./prefsContext";
import { UserCard } from "./UserCard";
import { useRoomLog } from "./useRoomLog";

type Props = {
  room: Room; cap: number; stamp: boolean; epoch: number; visible: boolean; fallback: boolean;
  onActivity: () => void; onFallback(on: boolean): void; onState(s: RoomState): void;
};

export function RoomView(p: Props) {
  const c = connectorOf(p.room.site);
  if (!c.connect) return <EmbedView room={p.room} />;
  if (p.fallback && c.embedFallback)
    return (
      <>
        <EmbedView room={{ site: "embed", target: c.embedFallback(p.room), label: p.room.label }} />
        <div className="chat-note"><button type="button" className="ui-btn" onClick={() => p.onFallback(false)}>Try native chat again</button></div>
      </>
    );
  return <SocketRoom {...p} />;
}

function SocketRoom({ room, cap, stamp, epoch, visible, onActivity, onFallback, onState }: Props) {
  const [retry, setRetry] = useState(0);
  const live = useRoom(room, cap, epoch, onActivity, retry);
  useEffect(() => onState({ status: live.status, detail: live.detail }), [live.status, live.detail]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useEmoteSets(live.channelId);
  const list = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true);
  const [who, setWho] = useState<string | null>(null);
  const prefs = usePrefs();
  const nick = live.link?.nick;
  const rows = live.messages.map((m) => ({ m, c: classify(m, prefs.filters) })).filter((x) => x.c !== "hide");
  useRoomLog(room.label, live.messages, (m) => isMention(m.text, nick) || classify(m, prefs.filters) === "highlight", prefs.logs, prefs.logCap);
  const player = prefs.players ? playerEmbed(room.site, room.target, location.hostname) : null;

  // Follow new messages unless the user scrolled up (pause-on-scroll-up).
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stuck) el.scrollTop = el.scrollHeight;
  }, [live.messages, stuck, visible]);

  return (
    <>
      {player && <iframe className="chat-player" src={player} title={`${room.label} stream`} allow="autoplay; fullscreen" allowFullScreen />}
      <ConnPanel status={live.status} detail={live.detail} log={live.log} canEmbed={!!connectorOf(room.site).embedFallback} onRetry={() => setRetry((n) => n + 1)} onEmbed={() => onFallback(true)} />
      <div
        className="chat-list"
        ref={list}
        onScroll={(e) => {
          const t = e.currentTarget;
          setStuck(isAtBottom(t.scrollTop, t.clientHeight, t.scrollHeight));
        }}
      >
        {rows.map(({ m, c }) => (
          <MessageRow key={m.id} m={m} set={set} stamp={stamp} mention={!m.self && (c === "highlight" || isMention(m.text, nick))} pref={prefs.users.get(userKey(room.site, m.user))} onUser={setWho} />
        ))}
      </div>
      {!stuck && (
        <button type="button" className="ui-btn chat-jump" onClick={() => setStuck(true)}>Paused — jump to latest</button>
      )}
      {who && <UserCard site={room.site} user={who} onClose={() => setWho(null)} />}
      <Composer live={live} set={set} />
    </>
  );
}
