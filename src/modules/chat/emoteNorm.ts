// Pure normalisers for the 7TV / BTTV / FFZ API payloads (all fields untrusted).
import type { EmoteSet } from "./emotes.ts";

const obj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const https = (u: string) => (u.startsWith("//") ? `https:${u}` : u.startsWith("https://") ? u : "");

/** Accepts `{emotes}` (global set) or `{emote_set: {emotes}}` (user). */
export function sevenTv(j: unknown): EmoteSet {
  const o = obj(j);
  const out: EmoteSet = new Map();
  for (const e of arr(obj(o.emote_set).emotes ?? o.emotes)) {
    const x = obj(e);
    const host = str(obj(obj(x.data).host).url);
    const url = https(host);
    if (!str(x.name) || !url) continue;
    out.set(str(x.name), { url: `${url}/1x.webp`, zeroWidth: ((Number(x.flags) || 0) & 1) === 1 });
  }
  return out;
}

/** Global: an array. User: `{channelEmotes, sharedEmotes}`. */
export function bttv(j: unknown): EmoteSet {
  const o = obj(j);
  const list = Array.isArray(j) ? j : [...arr(o.channelEmotes), ...arr(o.sharedEmotes)];
  const out: EmoteSet = new Map();
  for (const e of list) {
    const x = obj(e);
    if (str(x.code) && /^\w+$/.test(str(x.id))) out.set(str(x.code), { url: `https://cdn.betterttv.net/emote/${str(x.id)}/1x` });
  }
  return out;
}

/** FFZ: the sets named by `default_sets` (global) or `room.set` (room). */
export function ffz(j: unknown): EmoteSet {
  const o = obj(j);
  const ids = arr(o.default_sets).length ? arr(o.default_sets) : [obj(o.room).set];
  const out: EmoteSet = new Map();
  for (const id of ids) {
    for (const e of arr(obj(obj(o.sets)[String(id)]).emoticons)) {
      const x = obj(e);
      const urls = obj(x.urls);
      const url = https(str(urls["1"] ?? Object.values(urls)[0]));
      if (str(x.name) && url) out.set(str(x.name), { url });
    }
  }
  return out;
}
