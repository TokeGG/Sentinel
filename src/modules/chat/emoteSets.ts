// Third-party emote sets (7TV, BTTV, FFZ), fetched through the http plugin and
// cached in memory per channel. Emotes are optional: every failure is silent.
import { fetch } from "@tauri-apps/plugin-http";
import { bttv, ffz, sevenTv } from "./emoteNorm";
import { mergeSets, type EmoteSet } from "./emotes";

const getJson = async (url: string): Promise<unknown> => {
  const r = await fetch(url);
  return r.ok ? r.json() : null;
};
const safe = (p: Promise<EmoteSet>): Promise<EmoteSet> => p.catch(() => new Map());

const cache = new Map<string, Promise<EmoteSet>>();

/** Global sets (channelId null) or one Twitch channel's 7TV+BTTV+FFZ sets. */
export function loadEmoteSets(channelId: string | null): Promise<EmoteSet> {
  const key = channelId ?? "global";
  let p = cache.get(key);
  if (!p) {
    const id = channelId ? encodeURIComponent(channelId) : null;
    p = Promise.all(
      id
        ? [
            safe(getJson(`https://7tv.io/v3/users/twitch/${id}`).then(sevenTv)),
            safe(getJson(`https://api.betterttv.net/3/cached/users/twitch/${id}`).then(bttv)),
            safe(getJson(`https://api.frankerfacez.com/v1/room/id/${id}`).then(ffz)),
          ]
        : [
            safe(getJson("https://7tv.io/v3/emote-sets/global").then(sevenTv)),
            safe(getJson("https://api.betterttv.net/3/cached/emotes/global").then(bttv)),
            safe(getJson("https://api.frankerfacez.com/v1/set/global").then(ffz)),
          ]
    ).then((s) => mergeSets(...s));
    cache.set(key, p);
  }
  return p;
}
