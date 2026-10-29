// Writes new messages of a room to the local log: everything when the user turned
// logs on, otherwise only mentions/highlights (mention log). Capped in the store.
import { useEffect, useRef } from "react";
import { writeLogs } from "./extrasStore";
import type { Message } from "./types";

export function useRoomLog(room: string, messages: Message[], flagged: (m: Message) => boolean, all: boolean, cap: number) {
  const last = useRef(-1);
  const f = useRef(flagged);
  f.current = flagged;
  useEffect(() => {
    const fresh = messages.filter((m) => Number(m.id) > last.current && m.kind !== "notice" && !m.self);
    if (!messages.length) return;
    last.current = Math.max(last.current, Number(messages[messages.length - 1].id));
    const rows = fresh.map((m) => ({ room, user: m.user, text: m.text, ts: m.time, mention: f.current(m) ? 1 : 0 })).filter((r) => all || r.mention);
    if (rows.length) void writeLogs(rows, all ? Math.max(cap, 100) : 500).catch(() => {});
  }, [messages, room, all, cap]);
}
