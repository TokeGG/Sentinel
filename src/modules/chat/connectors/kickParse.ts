// Pure Kick (Pusher) payload parsing.
import type { Incoming, NativeEmote } from "../types.ts";

export const KICK_APP_KEY = "32cbd69e4b950bf97679";
export const KICK_WS = `wss://ws-us2.pusher.com/app/${KICK_APP_KEY}?protocol=7&client=js&version=8.4.0-rc2&flash=false`;
export const KICK_MESSAGE_EVENT = "App\\Events\\ChatMessageEvent";
export const KICK_BAN_EVENT = "App\\Events\\UserBannedEvent";

const EMOTE = /\[emote:(\d+):([^\]]*)\]/g;

/** Replaces `[emote:ID:name]` by `name` and returns the emote ranges (code points). */
export function kickEmotes(content: string): { text: string; native: NativeEmote[] } {
  const native: NativeEmote[] = [];
  let text = "";
  let last = 0;
  let len = 0; // code points of `text` so far
  for (const m of content.matchAll(EMOTE)) {
    const before = content.slice(last, m.index);
    text += before;
    len += Array.from(before).length;
    const name = m[2] || "emote";
    const n = Array.from(name).length;
    native.push({ name, start: len, end: len + n - 1, url: `https://files.kick.com/emotes/${m[1]}/fullsize` });
    text += name;
    len += n;
    last = m.index! + m[0].length;
  }
  return { text: text + content.slice(last), native };
}

const obj = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null);

/** Pusher envelope -> its inner JSON data (Pusher double-encodes `data`). */
export function pusherData(raw: string): { event: string; data: Record<string, unknown> | null } | null {
  try {
    const e = obj(JSON.parse(raw));
    if (!e || typeof e.event !== "string") return null;
    return { event: e.event, data: typeof e.data === "string" ? obj(JSON.parse(e.data)) : obj(e.data) };
  } catch {
    return null;
  }
}

export function kickMessage(d: Record<string, unknown>): Incoming | null {
  const sender = obj(d.sender);
  if (!sender || typeof d.content !== "string") return null;
  const identity = obj(sender.identity);
  const color = typeof identity?.color === "string" && /^#[0-9a-f]{6}$/i.test(identity.color) ? identity.color : undefined;
  const badges = Array.isArray(identity?.badges) ? identity.badges.map((b) => String(obj(b)?.type ?? "")).filter(Boolean) : [];
  const { text, native } = kickEmotes(d.content);
  const t = Date.parse(String(d.created_at));
  return { user: String(sender.username ?? sender.slug ?? "?"), text, native, color, badges, kind: "chat", time: Number.isNaN(t) ? Date.now() : t };
}

/** Channel API json -> chatroom id (null if the shape is not recognised). */
export function chatroomId(j: unknown): number | null {
  const id = obj(obj(j)?.chatroom)?.id;
  return typeof id === "number" ? id : null;
}
