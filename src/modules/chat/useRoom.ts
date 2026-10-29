import { useEffect, useRef, useState } from "react";
import { type ConnLog, createLog } from "./connLog";
import { applyClear, pushCapped } from "./panelLogic";
import { connectorOf } from "./connectors";
import type { Connection, Message, RoomRef, Status } from "./types";

export type RoomLive = {
  messages: Message[];
  status: Status;
  detail?: string;
  channelId: string | null;
  link: Pick<Connection, "send" | "note" | "nick"> | null;
  log: ConnLog;
};

/** Connects `room` for as long as the calling view is mounted (no background work).
 *  Incoming messages are batched (100 ms) so a busy chat is one render per tick.
 *  `epoch` changes force a reconnect (e.g. after saving a new token). */
export function useRoom(room: RoomRef, cap: number, epoch: number, onActivity: () => void, retry = 0): RoomLive {
  const log = useRef<ConnLog>(null as unknown as ConnLog);
  log.current ??= createLog();
  const [, setLogVer] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [st, setSt] = useState<{ status: Status; detail?: string }>({ status: "connecting" });
  const [channelId, setChannelId] = useState<string | null>(null);
  const [link, setLink] = useState<RoomLive["link"]>(null);
  const seq = useRef(0);
  const capRef = useRef(cap);
  const act = useRef(onActivity);
  capRef.current = cap;
  act.current = onActivity;

  useEffect(() => {
    const c = connectorOf(room.site);
    if (!c.connect) return;
    let dead = false;
    let conn: Connection | null = null;
    let buf: Parameters<typeof pushCapped>[1] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      const batch = buf;
      buf = [];
      if (dead || !batch.length) return;
      const at = seq.current;
      seq.current += batch.length;
      setMessages((l) => pushCapped(l, batch, at, capRef.current));
      act.current();
    };
    setLink(null);
    let first = true;
    const L = log.current;
    L.add(`--- connect ${room.site}:${room.site === "kick" ? room.target.split("@")[0] : room.target} ---`);
    c.connect(room, {
      log: (line) => {
        L.add(line);
        if (!dead) setLogVer((v) => v + 1);
      },
      onMessage: (m) => {
        if (first) {
          first = false;
          L.add("first message received");
          setLogVer((v) => v + 1);
        }
        buf.push(m);
        timer ??= setTimeout(flush, 100);
      },
      onStatus: (status, detail) => !dead && setSt({ status, detail }),
      onInfo: (i) => !dead && i.channelId && setChannelId(i.channelId),
      onClear: (u) => !dead && setMessages((l) => applyClear(l, u)),
    })
      .then((cn) => {
        if (dead) cn.close();
        else {
          conn = cn;
          setLink({ send: cn.send, note: cn.note, nick: cn.nick });
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        L.add(`connect failed: ${msg}`);
        if (!dead) {
          setSt({ status: "error", detail: msg });
          setLogVer((v) => v + 1);
        }
      });
    return () => {
      dead = true;
      clearTimeout(timer);
      conn?.close();
    };
  }, [room.site, room.target, epoch, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  return { messages, status: st.status, detail: st.detail, channelId, link, log: log.current };
}
