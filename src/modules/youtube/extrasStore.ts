// SQLite for YouTube extras (migration 38): playlists, channel groups, speed per
// channel, playback progress, per-channel "uploads seen" time. Local only.
import { getDb } from "../../core/db";
import { newUploads, total, type Progress } from "./extras.ts";
import type { Video } from "./recommend.ts";

export interface Playlist { id: number; name: string; items: { videoId: string; channelId: string | null; title: string }[] }
export interface YtExtras { playlists: Playlist[]; groups: { name: string; channelId: string }[]; speed: Map<string, number>; progress: Progress[]; seen: Map<string, number> }

const now = () => Math.floor(Date.now() / 1000);
const SEED = "INSERT OR IGNORE INTO yt_upload_seen (channel_id, seen_ts) SELECT channel_id, CAST(strftime('%s','now') AS INTEGER) FROM youtube_channels";

export async function loadExtras(): Promise<YtExtras> {
  const d = await getDb();
  await d.execute(SEED);
  const [pl, items, groups, speed, prog, seen] = await Promise.all([
    d.select<{ id: number; name: string }[]>("SELECT * FROM yt_playlists ORDER BY name COLLATE NOCASE"),
    d.select<{ playlist_id: number; json: string }[]>("SELECT playlist_id, json FROM yt_playlist_items ORDER BY position, rowid"),
    d.select<{ name: string; channel_id: string }[]>("SELECT * FROM yt_groups ORDER BY name"),
    d.select<{ channel_id: string; rate: number }[]>("SELECT * FROM yt_speed"),
    d.select<{ json: string; seconds: number; updated_at: number }[]>("SELECT json, seconds, updated_at FROM yt_progress ORDER BY updated_at DESC LIMIT 200"),
    d.select<{ channel_id: string; seen_ts: number }[]>("SELECT * FROM yt_upload_seen"),
  ]);
  const parse = (s: string) => { try { return JSON.parse(s); } catch { return {}; } };
  return {
    playlists: pl.map((p) => ({ ...p, items: items.filter((i) => i.playlist_id === p.id).map((i) => parse(i.json)) })),
    groups: groups.map((g) => ({ name: g.name, channelId: g.channel_id })),
    speed: new Map(speed.map((s) => [s.channel_id, s.rate])),
    progress: prog.map((p) => ({ ...parse(p.json), seconds: p.seconds, updatedAt: p.updated_at })),
    seen: new Map(seen.map((s) => [s.channel_id, s.seen_ts])),
  };
}

export async function createPlaylist(name: string) { await (await getDb()).execute("INSERT INTO yt_playlists (name) VALUES ($1)", [name]); }
export async function deletePlaylist(id: number) {
  const d = await getDb();
  await d.execute("DELETE FROM yt_playlist_items WHERE playlist_id=$1", [id]);
  await d.execute("DELETE FROM yt_playlists WHERE id=$1", [id]);
}
export async function addToPlaylist(id: number, v: { videoId: string; channelId: string | null; title: string }) {
  await (await getDb()).execute("INSERT OR IGNORE INTO yt_playlist_items (playlist_id, video_id, json, position) VALUES ($1,$2,$3,(SELECT COUNT(*) FROM yt_playlist_items WHERE playlist_id=$1))",
    [id, v.videoId, JSON.stringify({ videoId: v.videoId, channelId: v.channelId, title: v.title })]);
}
export async function removeFromPlaylist(id: number, videoId: string) { await (await getDb()).execute("DELETE FROM yt_playlist_items WHERE playlist_id=$1 AND video_id=$2", [id, videoId]); }

export async function setGroup(channelId: string, name: string, on: boolean) {
  const d = await getDb();
  if (on) await d.execute("INSERT OR IGNORE INTO yt_groups (name, channel_id) VALUES ($1,$2)", [name, channelId]);
  else await d.execute("DELETE FROM yt_groups WHERE name=$1 AND channel_id=$2", [name, channelId]);
}
export async function setSpeed(channelId: string, rate: number) {
  await (await getDb()).execute("INSERT OR REPLACE INTO yt_speed (channel_id, rate) VALUES ($1,$2)", [channelId, rate]);
}
export async function saveProgress(p: Omit<Progress, "updatedAt">) {
  await (await getDb()).execute("INSERT OR REPLACE INTO yt_progress (video_id, json, seconds, updated_at) VALUES ($1,$2,$3,$4)",
    [p.videoId, JSON.stringify({ videoId: p.videoId, channelId: p.channelId, title: p.title, duration: p.duration }), Math.floor(p.seconds), now()]);
}
export async function dropProgress(videoId: string) { await (await getDb()).execute("DELETE FROM yt_progress WHERE video_id=$1", [videoId]); }
export async function markUploadsSeen(channelId?: string) {
  const d = await getDb();
  if (channelId) await d.execute("INSERT OR REPLACE INTO yt_upload_seen (channel_id, seen_ts) VALUES ($1,$2)", [channelId, now()]);
  else await d.execute("UPDATE yt_upload_seen SET seen_ts=$1", [now()]);
}

/** Planet badge: new uploads since each channel was last looked at (a count only). */
export async function uploadBadge(): Promise<number> {
  const d = await getDb();
  await d.execute(SEED);
  const seen = await d.select<{ channel_id: string; seen_ts: number }[]>("SELECT * FROM yt_upload_seen");
  const vids = await d.select<{ channel_id: string; published_at: string | null }[]>("SELECT channel_id, published_at FROM youtube_videos WHERE published_at IS NOT NULL ORDER BY published_at DESC LIMIT 500");
  const vs: Video[] = vids.map((v) => ({ videoId: "", channelId: v.channel_id, channel: "", title: "", publishedAt: v.published_at }));
  return total(newUploads(vs, new Map(seen.map((s) => [s.channel_id, s.seen_ts]))));
}
