import type { Connection, Connector, Handlers, RoomRef } from "../types";
import { dggMessage, parseFrame } from "./dggParse";
import { parseDgg } from "./rooms";
import { openSocket } from "./socket";

const NOTE = "Read-only: destiny.gg sending needs your site login cookie, which this app does not handle. Use an Embed (https://www.destiny.gg/embed/chat) to chat.";

async function connect(_room: RoomRef, h: Handlers): Promise<Connection> {
  const sock = openSocket(
    {
      url: "wss://chat.destiny.gg/ws",
      onOpen: () => {},
      onData: (raw, s) => {
        const { cmd, data } = parseFrame(raw);
        if (cmd === "PING") s.send(`PONG ${JSON.stringify({ timestamp: Date.now() })}`);
        else if (cmd === "ERR") h.onStatus("error", String(data?.description ?? data?.data ?? "chat server error"));
        else if (cmd === "MUTE" || cmd === "BAN") h.onClear?.(typeof data?.data === "string" ? data.data : undefined);
        else {
          const m = dggMessage(cmd, data);
          if (m) h.onMessage(m);
        }
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
};
