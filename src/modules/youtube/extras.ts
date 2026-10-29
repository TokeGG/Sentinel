// Pure helpers for YouTube extras: player URL + IFrame-API messages (speed, progress),
// continue watching, per-channel new-upload counts, channel groups.
import { when } from "./library.ts";
import type { Video } from "./recommend.ts";

export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
/** Embed URL with the JS API on (needed for speed + progress) and an optional resume point. */
export function playerUrl(id: string, opts: { start?: number; origin?: string } = {}): string | null {
  if (!/^[\w-]{11}$/.test(id)) return null;
  const p = new URLSearchParams({ autoplay: "1", rel: "0", enablejsapi: "1" });
  if (opts.start && opts.start > 0) p.set("start", String(Math.floor(opts.start)));
  if (opts.origin && /^https?:\/\//.test(opts.origin)) p.set("origin", opts.origin);
  return `https://www.youtube-nocookie.com/embed/${id}?${p}`;
}
/** postMessage payloads understood by the YouTube IFrame API. */
export const listenMsg = () => JSON.stringify({ event: "listening", id: 1, channel: "widget" });
export const rateMsg = (rate: number) => JSON.stringify({ event: "command", func: "setPlaybackRate", args: [rate] });
/** infoDelivery -> { time, duration } (either may be missing); anything else -> null. */
export function parsePlayerMsg(data: unknown): { time?: number; duration?: number } | null {
  let o: unknown = data;
  if (typeof data === "string") { try { o = JSON.parse(data); } catch { return null; } }
  const info = (o as { event?: string; info?: Record<string, unknown> } | null);
  if (!info || info.event !== "infoDelivery" || !info.info) return null;
  const t = Number(info.info.currentTime), d = Number(info.info.duration);
  const out: { time?: number; duration?: number } = {};
  if (Number.isFinite(t)) out.time = t;
  if (Number.isFinite(d) && d > 0) out.duration = d;
  return out.time === undefined && out.duration === undefined ? null : out;
}

export interface Progress { videoId: string; channelId: string | null; title: string; seconds: number; duration: number; updatedAt: number }
/** Started (> 30 s) but not finished (> 30 s or 5 % left), newest first. */
export function continueList(ps: Progress[], limit = 12): Progress[] {
  return ps.filter((p) => p.seconds > 30 && (!p.duration || (p.duration - p.seconds > 30 && p.seconds / p.duration < 0.95)))
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}
export const progressPct = (p: Progress) => (p.duration ? Math.min(100, Math.round((p.seconds / p.duration) * 100)) : 0);

/** Videos per channel published after that channel's "seen" time (unix s). Channels without a seen time count 0. */
export function newUploads(videos: Video[], seen: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of videos) {
    const s = seen.get(v.channelId), t = when(v.publishedAt);
    if (s === undefined || Number.isNaN(t) || t / 1000 <= s) continue;
    out.set(v.channelId, (out.get(v.channelId) ?? 0) + 1);
  }
  return out;
}
export const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

/** group name -> channel ids. */
export function groupMap(rows: { name: string; channelId: string }[]): Map<string, Set<string>> {
  const g = new Map<string, Set<string>>();
  for (const r of rows) { if (!g.has(r.name)) g.set(r.name, new Set()); g.get(r.name)!.add(r.channelId); }
  return g;
}
/** Chip id "grp:<name>" keeps only that group's channels; other chips pass through. */
export function byGroup<T extends { channelId: string | null }>(xs: T[], chip: string, groups: Map<string, Set<string>>): T[] {
  if (!chip.startsWith("grp:")) return xs;
  const set = groups.get(chip.slice(4)) ?? new Set();
  return xs.filter((x) => !!x.channelId && set.has(x.channelId));
}
export const cleanName = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 40);
