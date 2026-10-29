import { useLayoutEffect, useRef, useState } from "react";
import { connectorOf } from "./connectors";
import { Composer } from "./Composer";
import { EmbedView } from "./EmbedView";
import { MessageRow } from "./MessageRow";
import { isAtBottom, isMention } from "./panelLogic";
import type { Room } from "./types";
import { useEmoteSets } from "./useEmoteSets";
import { useRoom } from "./useRoom";

type Props = { room: Room; cap: number; stamp: boolean; epoch: number; visible: boolean; onActivity: () => void };

export function RoomView(p: Props) {
  return connectorOf(p.room.site).connect ? <SocketRoom {...p} /> : <EmbedView room={p.room} />;
}

function SocketRoom({ room, cap, stamp, epoch, visible, onActivity }: Props) {
  const live = useRoom(room, cap, epoch, onActivity);
  const set = useEmoteSets(live.channelId);
  const list = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(true);

  // Follow new messages unless the user scrolled up (pause-on-scroll-up).
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stuck) el.scrollTop = el.scrollHeight;
  }, [live.messages, stuck, visible]);

  return (
    <>
      {live.status !== "open" && (
        <div className={`chat-note${live.status === "error" ? " chat-err" : ""}`}>
          {live.status === "connecting" ? "Connecting…" : live.status === "closed" ? (live.detail ?? "Disconnected") : (live.detail ?? "Error")}
        </div>
      )}
      <div
        className="chat-list"
        ref={list}
        onScroll={(e) => {
          const t = e.currentTarget;
          setStuck(isAtBottom(t.scrollTop, t.clientHeight, t.scrollHeight));
        }}
      >
        {live.messages.map((m) => (
          <MessageRow key={m.id} m={m} set={set} stamp={stamp} mention={!m.self && isMention(m.text, live.link?.nick)} />
        ))}
      </div>
      {!stuck && (
        <button type="button" className="ui-btn chat-jump" onClick={() => setStuck(true)}>Paused — jump to latest</button>
      )}
      <Composer live={live} />
    </>
  );
}
