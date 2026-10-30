// Pure helpers for the YouTube panel: row splitting and URLs. Ranking is in
// recommend.ts, history/signal merging in library.ts, view helpers in viewLogic.ts.
import { numOption } from "../../ui/numOption.ts";
import type { Sig, Watched } from "./library.ts";
import type { Video } from "./recommend.ts";

type Row = Record<string, unknown>;

export const ytSections = [
  { id: "add", label: "Add channel by link" },
  { id: "chips", label: "Filter chips" },
  { id: "live", label: "Live now" },
  { id: "continue", label: "Continue watching" },
  { id: "recommended", label: "Recommended" },
  { id: "latest", label: "Latest videos" },
  { id: "later", label: "Watch later" },
  { id: "playlists", label: "Playlists" },
  { id: "tray", label: "Watch-later tray" },
  { id: "channels", label: "Channels" },
  { id: "history", label: "Watch history & import" },
  { id: "status", label: "Refresh & auto-refresh" },
];

export interface Channel { channelId: string; title: string; handle: string | null }
export interface Later { videoId: string; channelId: string | null; title: string; addedAt: string | null }

const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "string" && v ? v : null);

/** load() returns one flat list tagged by `kind`; split it back out. */
export function splitRows(rows: Row[]) {
  const out = { videos: [] as Video[], watched: [] as Watched[], channels: [] as Channel[], later: [] as Later[], signals: [] as Sig[] };
  for (const r of rows) {
    if (r.kind === "video")
      out.videos.push({ videoId: s(r.video_id), channelId: s(r.channel_id), channel: s(r.channel_title), title: s(r.title), publishedAt: n(r.published_at) });
    else if (r.kind === "watched")
      out.watched.push({ videoId: s(r.video_id), channelId: n(r.channel_id), title: s(r.title), watchedAt: n(r.last_at), firstAt: n(r.first_at), count: Number(r.watch_count) || 1 });
    else if (r.kind === "channel") out.channels.push({ channelId: s(r.channel_id), title: s(r.title), handle: n(r.handle) });
    else if (r.kind === "later") out.later.push({ videoId: s(r.video_id), channelId: n(r.channel_id), title: s(r.title), addedAt: n(r.added_at) });
    else if (r.kind === "signal")
      out.signals.push({ kind: r.target_kind === "channel" ? "channel" : "video", id: s(r.target_id), signal: r.signal === "like" || r.signal === "dislike" ? r.signal : "hide", channelId: n(r.channel_id), title: s(r.title), at: n(r.at) });
  }
  return out;
}

/** Embed URL for a valid 11-char video id, else null. */
export function embedUrl(id: string): string | null {
  return /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
}
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const ytLimits = [numOption("trayCards", "Videos in the Watch later tray", 20, 4, 60)];
