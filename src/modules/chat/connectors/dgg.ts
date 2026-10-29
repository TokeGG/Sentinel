import type { Connection, Connector, Handlers, RoomRef } from "../types";
import { dggEvent } from "./dggParse";
import { parseDgg } from "./rooms";
import { openSocket } from "./socket";
import { dropCounter } from "../connLog";

const NOTE = "Read-only: sending on destiny.gg needs a site login (cookie) that this app does not handle. Use the embed (https://www.destiny.gg/embed/chat) to chat.";

async function connect(_room: RoomRef, h: Handlers): Promise<Connection> {
  const log = h.log ?? (() => {});
  const drop = dropCounter(log);
  const kinds = new Set<string>();
  const seen = (c: string) => kinds.has(c) || (kinds.add(c), log(`first ${c} frame received`));
  const sock = openSocket(
    {
      url: "wss://chat.destiny.gg/ws",
      onOpen: () => log("socket open (the app's page Origin is sent; if the server rejects it you will see close code 1006 or 403)"),
      onData: (raw, s) => {
        const e = dggEvent(raw);
        if (e.kind === "ping") s.send(`PONG ${JSON.stringify({ timestamp: Date.now() })}`);
        else if (e.kind === "error") {
          log(`ERR ${e.text}`);
          h.onStatus("error", e.text);
        } else if (e.kind === "clear") h.onClear?.(e.user);
        else if (e.kind === "message") {
          seen("MSG");
          h.onMessage(e.m);
        }
        else if (e.kind === "ignore") seen(e.cmd);
        else drop();
      },
    },
    h
  );
  return { close: () => sock.close(), note: NOTE };
}

export const dgg: Connector = {
  id: "dgg",
  label: "destiny.gg",
  color: "#4a90e2",
  placeholder: "destiny.gg",
  parseRoom: parseDgg,
  connect,
  defaultEmbed: true,
  embedFallback: () => "https://www.destiny.gg/embed/chat",
};
