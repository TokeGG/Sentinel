// Pure: merges detected installs with local meta (favourite, last played) for the Games panel.
import { epicLaunchUri, steamLaunchUri, type EpicApp } from "./epic.ts";
import type { OtherApp } from "./reg.ts";
import type { SteamApp } from "./vdf.ts";

export const gamesSections = [
  { id: "recent", label: "Recently played" },
  { id: "library", label: "Library" },
  { id: "news", label: "Patch notes" },
  { id: "actions", label: "Scan + refresh" },
];

export interface Meta { game_key: string; favorite: number; last_played: string | null; plays: number }
/** `uri` is "" when the store has no allow-listed launch URI (GOG/Ubisoft/Battle.net/EA): panel shows the path. */
export interface Game { key: string; store: "steam" | "epic" | OtherApp["store"]; name: string; appid: string; uri: string; favorite: boolean; lastPlayed: number; path?: string }

export function mergeLibrary(steam: SteamApp[], epic: EpicApp[], meta: Meta[], others: OtherApp[] = []): Game[] {
  const m = new Map(meta.map((x) => [x.game_key, x]));
  const last = (k: string, own: number) => Math.max(own, Date.parse(m.get(k)?.last_played ?? "") / 1000 || 0);
  const out: Game[] = [];
  for (const a of steam) {
    const key = `steam:${a.appid}`;
    out.push({ key, store: "steam", name: a.name, appid: a.appid, uri: steamLaunchUri(a.appid)!, favorite: !!m.get(key)?.favorite, lastPlayed: last(key, a.lastPlayed) });
  }
  for (const a of epic) {
    const key = `epic:${a.appName}`;
    out.push({ key, store: "epic", name: a.name, appid: "", uri: epicLaunchUri(a), favorite: !!m.get(key)?.favorite, lastPlayed: last(key, 0), path: a.installLocation });
  }
  for (const a of others) {
    const key = `${a.store}:${a.id}`;
    out.push({ key, store: a.store, name: a.name, appid: "", uri: "", favorite: !!m.get(key)?.favorite, lastPlayed: last(key, 0), path: a.path });
  }
  const seen = new Set<string>();
  return out.filter((g) => !seen.has(g.key) && seen.add(g.key)).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
}

export const recentGames = (g: Game[], n = 6): Game[] => g.filter((x) => x.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, n);

export function filterGames(g: Game[], q: string, favOnly: boolean): Game[] {
  const s = q.trim().toLowerCase();
  return g.filter((x) => (!favOnly || x.favorite) && (!s || x.name.toLowerCase().includes(s)));
}

/** Steam apps to fetch news for: favourites first, then most recently played; at most `max`. */
export function newsTargets(g: Game[], max = 12): string[] {
  const steam = g.filter((x) => x.store === "steam");
  const order = [...steam.filter((x) => x.favorite), ...recentGames(steam, max)];
  return [...new Set(order.map((x) => x.appid))].slice(0, max);
}

export const playedText = (secs: number, now = Date.now()): string => {
  if (!secs) return "never";
  const d = Math.floor((now / 1000 - secs) / 86400);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
