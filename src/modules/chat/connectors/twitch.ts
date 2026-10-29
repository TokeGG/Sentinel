import { fetch } from "@tauri-apps/plugin-http";
import { getCredential } from "../../../core/credentials";
import type { Connection, Connector, Handlers, RoomRef } from "../types";
import { parseTwitch } from "./rooms";
import { openSocket } from "./socket";
import { clearTarget, parseLine, toIncoming } from "./twitchIrc";

export const TWITCH_CRED = "twitch_oauth";
const HELP =
  "To send, paste a Twitch OAuth token with the chat:read and chat:edit scopes. " +
  "Easiest: generate one at twitchtokengenerator.com (a third-party tool: choose 'Bot Chat Token'); " +
  "or register your own app at dev.twitch.tv/console and use its implicit-grant URL. " +
  "It is stored in your OS keychain only. Without it, chat is read-only.";

/** Token -> login (null when invalid/expired or missing chat:edit). */
async function whoami(token: string): Promise<{ login: string } | null> {
  const res = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } });
  if (!res.ok) return null;
  const j = (await res.json()) as { login?: string; scopes?: string[] };
  return j.login && j.scopes?.includes("chat:edit") ? { login: j.login } : null;
}

async function connect(room: RoomRef, h: Handlers): Promise<Connection> {
  const raw = ((await getCredential("hub.chat", TWITCH_CRED).catch(() => null)) ?? "").trim().replace(/^oauth:/i, "");
  const me = raw ? await whoami(raw).catch(() => null) : null;
  const note = raw && !me ? "Saved Twitch token is invalid, expired or lacks chat:edit: read-only." : "Read-only: add a Twitch OAuth token (Login section) to send.";
  const nick = me?.login ?? `justinfan${Math.floor(10000 + Math.random() * 89999)}`;
  const chan = `#${room.target}`;
  const sock = openSocket(
    {
      url: "wss://irc-ws.chat.twitch.tv:443",
      onOpen: (s) => {
        s.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
        s.send(`PASS ${me ? `oauth:${raw}` : "SCHMOOPIIE"}`);
        s.send(`NICK ${nick}`);
        s.send(`JOIN ${chan}`);
      },
      onData: (data, s) => {
        for (const line of data.split("\r\n")) {
          const l = line ? parseLine(line) : null;
          if (!l) continue;
          if (l.command === "PING") s.send(`PONG :${l.params[0] ?? "tmi.twitch.tv"}`);
          else if (l.command === "ROOMSTATE" && l.tags["room-id"]) h.onInfo?.({ channelId: l.tags["room-id"] });
          else if (l.command === "NOTICE") {
            const text = l.params[1] ?? "";
            h.onMessage({ user: "", text, time: Date.now(), kind: "notice" });
            if (/authentication failed/i.test(text)) h.onStatus("error", text);
          } else {
            const m = toIncoming(l, me?.login);
            if (m) h.onMessage(m);
            const c = clearTarget(l);
            if (c !== null) h.onClear?.(c || undefined);
          }
        }
      },
    },
    h
  );
  return {
    close: () => sock.close(),
    nick: me?.login,
    note: me ? undefined : note,
    send: me
      ? async (text) => {
          sock.send(`PRIVMSG ${chan} :${text.replace(/[\r\n]+/g, " ")}`);
          // Twitch does not echo your own PRIVMSG back, so show it locally.
          h.onMessage({ user: me.login, text, time: Date.now(), kind: "chat", self: true });
        }
      : undefined,
  };
}

export const twitch: Connector = {
  id: "twitch",
  label: "Twitch",
  color: "#9146ff",
  placeholder: "channel name or twitch.tv URL",
  parseRoom: parseTwitch,
  connect,
  auth: { credentialKey: TWITCH_CRED, help: HELP },
};
