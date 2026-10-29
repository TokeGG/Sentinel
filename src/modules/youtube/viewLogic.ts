// Pure view helpers for the YouTube panel: navigation, chips, filtering, up-next, avatars.
import { hiddenOf, isHidden, type Sig, type Watched } from "./library.ts";
import type { Channel } from "./panelLogic.ts";
import type { Video } from "./recommend.ts";

export type View = "home" | "subs" | "later" | "playlists" | "history" | "live" | "watch";
export const NAV: { view: Exclude<View, "watch">; label: string; icon: string }[] = [
  { view: "home", label: "Home", icon: "⌂" },
  { view: "subs", label: "Channels", icon: "▤" },
  { view: "live", label: "Live", icon: "●" },
  { view: "later", label: "Watch later", icon: "⏲" },
  { view: "playlists", label: "Playlists", icon: "≣" },
  { view: "history", label: "History", icon: "↺" },
];

/** "all", "unwatched" or "ch:<channelId>". */
export type Chip = string;
export const chipsFor = (channels: Channel[]): { id: Chip; label: string }[] => [
  { id: "all", label: "All" },
  ...channels.map((c) => ({ id: `ch:${c.channelId}`, label: c.title })),
  { id: "unwatched", label: "Unwatched" },
];

export interface Filter { chip: Chip; query: string; seen: Set<string>; signals: Sig[] }
/** Latest-video grid: drops hidden videos/channels, then applies chip and search. */
export function filterVideos(videos: Video[], f: Filter): Video[] {
  const hidden = hiddenOf(f.signals);
  const q = f.query.trim().toLowerCase();
  return videos.filter((v) =>
    !isHidden(hidden, v.videoId, v.channelId) &&
    (f.chip === "all" || (f.chip === "unwatched" ? !f.seen.has(v.videoId) : f.chip === `ch:${v.channelId}`)) &&
    (!q || v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q)));
}

/** Watch view's right column: ranked picks first, then newest unwatched; never the playing video. */
export function upNext(current: string, ranked: Video[], latest: Video[], seen: Set<string>, limit = 12): Video[] {
  const out = new Map<string, Video>();
  for (const v of [...ranked, ...latest.filter((x) => !seen.has(x.videoId))]) if (v.videoId !== current && !out.has(v.videoId)) out.set(v.videoId, v);
  return [...out.values()].slice(0, limit);
}

/** Watch-history search over title only. */
export const matchWatched = (w: Watched[], query: string) => {
  const q = query.trim().toLowerCase();
  return q ? w.filter((x) => x.title.toLowerCase().includes(q)) : w;
};

/** Initial + hue so a channel keeps one colour everywhere. */
export function avatar(name: string): { initial: string; hue: number } {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { initial: ([...name.trim()][0] ?? "?").toUpperCase(), hue: h % 360 };
}

/** 83 -> "1:23", 3725 -> "1:02:05"; "" when unknown. */
export function fmtDuration(secs: number | null | undefined): string {
  if (secs == null || !Number.isFinite(secs) || secs <= 0) return "";
  const t = Math.floor(secs);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "3d" -> "3d ago"; "just now" stays; "" stays. */
export const agoLabel = (a: string): string => (!a || a === "just now" ? a : `${a} ago`);
