import { fetch } from "@tauri-apps/plugin-http";
import type { Connection, Connector, Handlers, RoomRef } from "../types";
import { chatroomId, KICK_BAN_EVENT, KICK_MESSAGE_EVENT, KICK_WS, kickMessage, pusherData } from "./kickParse";
import { parseKick } from "./rooms";
import { openSocket } from "./socket";

const NOTE = "Read-only: Kick sending needs an app login (not available).";

async function lookup(slug: string): Promise<number> {
  const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
  });
  if (res.status === 403 || res.status === 429)
    throw new Error(`Kick blocked the channel lookup (HTTP ${res.status}, likely Cloudflare). Try again later, or add this channel as an Embed: https://kick.com/popout/${slug}/chat`);
  if (res.status === 404) throw new Error(`Kick channel "${slug}" not found`);
  if (!res.ok) throw new Error(`Kick channel lookup failed (HTTP ${res.status})`);
  const id = chatroomId(await res.json().catch(() => null));
  if (id === null) throw new Error("Kick channel lookup returned an unexpected shape (the API may have changed)");
  return id;
}

async function connect(room: RoomRef, h: Handlers): Promise<Connection> {
  const channel = `chatrooms.${await lookup(room.target)}.v2`;
  const sock = openSocket(
    {
      url: KICK_WS,
      onOpen: () => {},
      keepalive: { everyMs: 60_000, data: '{"event":"pusher:ping","data":{}}' },
      onData: (raw, s) => {
        const e = pusherData(raw);
        if (!e) return;
        if (e.event === "pusher:connection_established") s.send(JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel } }));
        else if (e.event === "pusher:ping") s.send('{"event":"pusher:pong","data":{}}');
        else if (e.event === "pusher:error") h.onStatus("error", JSON.stringify(e.data));
        else if (e.event === KICK_MESSAGE_EVENT && e.data) {
          const m = kickMessage(e.data);
          if (m) h.onMessage(m);
        } else if (e.event === KICK_BAN_EVENT) {
          const u = (e.data?.user as { username?: string } | undefined)?.username;
          h.onClear?.(u);
        }
      },
    },
    h
  );
  return { close: () => sock.close(), note: NOTE };
}

export const kick: Connector = {
  id: "kick",
  label: "Kick",
  color: "#53fc18",
  placeholder: "channel slug or kick.com URL",
  parseRoom: parseKick,
  connect,
};
