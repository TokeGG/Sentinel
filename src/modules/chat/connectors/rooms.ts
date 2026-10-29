// Pure room-input parsing: a pasted URL or a bare name -> RoomRef (or null).
import type { RoomRef } from "../types.ts";

const urlOf = (s: string): URL | null => {
  try {
    return new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
};
const hostIs = (u: URL, d: string) => u.hostname === d || u.hostname.endsWith(`.${d}`);
const looksUrl = (s: string) => /^[a-z]+:\/\//i.test(s) || /[./]/.test(s);

/** First path segment, skipping `popout`/`embed` wrappers (twitch.tv/popout/x/chat). */
function slug(u: URL): string {
  const p = u.pathname.split("/").filter(Boolean);
  return (["popout", "embed"].includes(p[0]) ? p[1] : p[0]) ?? "";
}

const TWITCH_RESERVED = new Set(["directory", "videos", "settings", "downloads", "jobs", "turbo", "store", "p", "popout", "embed", "u"]);

export function parseTwitch(input: string): RoomRef | null {
  const s = input.trim().replace(/^#/, "");
  let name = s;
  if (looksUrl(s)) {
    const u = urlOf(s);
    if (!u || !hostIs(u, "twitch.tv")) return null;
    name = slug(u);
    if (TWITCH_RESERVED.has(name)) return null;
  }
  return /^[a-z0-9_]{2,25}$/i.test(name) ? { site: "twitch", target: name.toLowerCase(), label: name.toLowerCase() } : null;
}

export function parseKick(input: string): RoomRef | null {
  const s = input.trim();
  let name = s;
  if (looksUrl(s)) {
    const u = urlOf(s);
    if (!u || !hostIs(u, "kick.com")) return null;
    name = slug(u);
  }
  return /^[a-z0-9_-]{2,25}$/i.test(name) && !["video", "categories", "browse"].includes(name.toLowerCase())
    ? { site: "kick", target: name.toLowerCase(), label: name.toLowerCase() }
    : null;
}

export function parseDgg(input: string): RoomRef | null {
  const s = input.trim();
  const u = looksUrl(s) ? urlOf(s) : null;
  const ok = u ? hostIs(u, "destiny.gg") || u.hostname === "d.gg" : /^(d\.?gg|destiny(\.gg)?)$/i.test(s);
  return ok ? { site: "dgg", target: "destiny.gg", label: "destiny.gg" } : null;
}

const YT_ID = /^[\w-]{11}$/;
/** YouTube live chat from a watch / youtu.be / live / live_chat URL (or a bare 11-char video id). */
export function parseYoutube(input: string): RoomRef | null {
  const s = input.trim();
  let id = s;
  if (looksUrl(s)) {
    const u = urlOf(s);
    if (!u || u.protocol !== "https:" || u.username || u.password) return null;
    const p = u.pathname.split("/").filter(Boolean);
    if (u.hostname === "youtu.be") id = p[0] ?? "";
    else if (!hostIs(u, "youtube.com")) return null;
    else if (p[0] === "watch" || p[0] === "live_chat") id = u.searchParams.get("v") ?? "";
    else if (p[0] === "live") id = p[1] ?? "";
    else return null;
  }
  return YT_ID.test(id) ? { site: "youtube", target: id, label: `youtube ${id}` } : null;
}
/** Chat iframe source (embed_domain must be the embedding page's host) and the top-level popout for "Open as its own panel". */
export const youtubeChatUrls = (id: string, host: string) => ({
  frame: `https://www.youtube.com/live_chat?v=${id}&embed_domain=${encodeURIComponent(host)}`,
  panel: `https://www.youtube.com/live_chat?is_popout=1&v=${id}`,
});

/** Any https page (a chat popout/embed URL). Never matches a bare word. */
export function parseEmbed(input: string): RoomRef | null {
  const s = input.trim();
  if (!looksUrl(s)) return null;
  const u = urlOf(s);
  if (!u || u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
  return { site: "embed", target: u.href, label: u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname.slice(0, 24) : "") };
}

const PARSERS: Record<string, (s: string) => RoomRef | null> = { twitch: parseTwitch, kick: parseKick, dgg: parseDgg, youtube: parseYoutube, embed: parseEmbed };

/** Parse input for `site`; "auto" needs a URL (a bare name is ambiguous) and
 *  tries the sites in order, with `embed` as the catch-all last. */
export function detectRoom(input: string, site = "auto"): RoomRef | null {
  if (site !== "auto") return PARSERS[site]?.(input) ?? null;
  if (!looksUrl(input.trim())) return null;
  for (const p of Object.values(PARSERS)) {
    const r = p(input);
    if (r) return r;
  }
  return null;
}
