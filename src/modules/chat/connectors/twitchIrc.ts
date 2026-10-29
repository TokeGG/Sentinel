// Pure Twitch IRC (IRCv3 tags) line parser and PRIVMSG/USERNOTICE mapping.
import type { Incoming, NativeEmote } from "../types.ts";

export interface IrcLine { tags: Record<string, string>; nick: string; command: string; params: string[] }

const UNESC: Record<string, string> = { ":": ";", s: " ", r: "\r", n: "\n", "\\": "\\" };
const unescape = (v: string) => v.replace(/\\(.)/g, (_, c: string) => UNESC[c] ?? c);

/** One IRC line (no CRLF). Trailing param ("... :text") is the last of `params`. */
export function parseLine(raw: string): IrcLine | null {
  let s = raw.replace(/[\r\n]+$/, "");
  const tags: Record<string, string> = {};
  if (s.startsWith("@")) {
    const sp = s.indexOf(" ");
    if (sp < 0) return null;
    for (const t of s.slice(1, sp).split(";")) {
      const eq = t.indexOf("=");
      tags[eq < 0 ? t : t.slice(0, eq)] = eq < 0 ? "" : unescape(t.slice(eq + 1));
    }
    s = s.slice(sp + 1);
  }
  let nick = "";
  if (s.startsWith(":")) {
    const sp = s.indexOf(" ");
    if (sp < 0) return null;
    nick = s.slice(1, sp).split("!")[0];
    s = s.slice(sp + 1);
  }
  const ti = s.indexOf(" :");
  const head = (ti < 0 ? s : s.slice(0, ti)).split(" ").filter(Boolean);
  const command = head.shift();
  if (!command) return null;
  return { tags, nick, command, params: ti < 0 ? head : [...head, s.slice(ti + 2)] };
}

/** "25:0-4,12-16/1902:6-10" -> ranges with CDN urls (names cut from `text`). */
export function parseEmotes(tag: string | undefined, text: string): NativeEmote[] {
  if (!tag) return [];
  const cps = Array.from(text);
  const out: NativeEmote[] = [];
  for (const group of tag.split("/")) {
    const [id, ranges] = group.split(":");
    if (!id || !ranges || !/^[\w-]+$/.test(id)) continue;
    for (const r of ranges.split(",")) {
      const [a, b] = r.split("-").map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < a || b >= cps.length) continue;
      out.push({ name: cps.slice(a, b + 1).join(""), start: a, end: b, url: `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0` });
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

export const parseBadges = (tag: string | undefined) => (tag ? tag.split(",").map((b) => b.split("/")[0]).filter(Boolean) : []);

const time = (t: IrcLine) => Number(t.tags["tmi-sent-ts"]) || Date.now();

function chat(l: IrcLine, user: string, body: string, kind: Incoming["kind"], self: boolean): Incoming {
  const action = /^\u0001ACTION (.*?)\u0001?$/s.exec(body);
  const text = action ? action[1] : body;
  return {
    user, text, time: time(l), kind: action && kind === "chat" ? "action" : kind,
    color: /^#[0-9a-f]{6}$/i.test(l.tags.color ?? "") ? l.tags.color : undefined,
    badges: parseBadges(l.tags.badges),
    // ranges count from the start of the raw body, ACTION prefix (8 chars) included
    native: parseEmotes(l.tags.emotes, body).map((e) => (action ? { ...e, start: e.start - 8, end: e.end - 8 } : e)),
    self,
  };
}

/** PRIVMSG / USERNOTICE -> a message; other commands -> null. */
export function toIncoming(l: IrcLine, me?: string): Incoming | null {
  if (l.command === "PRIVMSG") {
    const user = l.tags["display-name"] || l.nick;
    return chat(l, user, l.params[1] ?? "", "chat", !!me && l.nick === me.toLowerCase());
  }
  if (l.command === "USERNOTICE") {
    const sys = l.tags["system-msg"] || l.tags["msg-id"] || "notice";
    const user = l.params[1] ? (l.tags["display-name"] || l.nick) : "";
    return { ...chat(l, user, l.params[1] ?? "", "notice", false), text: user ? `${sys} — ${l.params[1]}` : sys, native: [] };
  }
  return null;
}

/** CLEARCHAT: user name of a ban/timeout, "" for a full clear, null if not CLEARCHAT. */
export function clearTarget(l: IrcLine): string | null {
  return l.command === "CLEARCHAT" ? (l.params[1] ?? "") : null;
}
