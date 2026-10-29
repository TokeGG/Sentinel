import { fetch } from "@tauri-apps/plugin-http";
import { dropCounter } from "../connLog";
import type { Connection, Connector, Handlers, RoomRef } from "../types";
import { kickFrame } from "./kickFrames";
import { type Fetch, resolveChatroom, splitKickTarget } from "./kickLookup";
import { KICK_WS } from "./kickParse";
import { parseKick } from "./rooms";
import { openSocket } from "./socket";

const NOTE = "Read-only: Kick sending needs an app login (not available).";

async function connect(room: RoomRef, h: Handlers): Promise<Connection> {
  const log = h.log ?? (() => {});
  const { slug, chatroom } = splitKickTarget(room.target);
  log(`resolving channel "${slug}"`);
  const channel = `chatrooms.${await resolveChatroom(slug, fetch as unknown as Fetch, log, chatroom)}.v2`;
  const drop = dropCounter(log);
  const sock = openSocket(
    {
      url: KICK_WS,
      onOpen: () => log("socket open, waiting for pusher:connection_established"),
      keepalive: { everyMs: 60_000, data: '{"event":"pusher:ping","data":{}}' },
      onData: (raw, s) => {
        const a = kickFrame(raw, channel);
        if (a.log) log(a.log);
        if (a.drop) drop();
        if (a.send) s.send(a.send);
        if (a.error) h.onStatus("error", a.error);
        if (a.message) h.onMessage(a.message);
        if (a.clear) h.onClear?.(a.clear.user);
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
  embedFallback: (r) => `https://kick.com/popout/${encodeURIComponent(splitKickTarget(r.target).slug)}/chat`,
};
