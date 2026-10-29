// Pure: the local library model. Watch history is ONE row per video (latest
// watched_at + a count); "signals" are the user's thumbs and "not interested".
export interface Watched { videoId: string; channelId: string | null; title: string; watchedAt: string | null; firstAt: string | null; count: number }
export type SigKind = "video" | "channel";
export type SigName = "like" | "dislike" | "hide";
export interface Sig { kind: SigKind; id: string; signal: SigName; channelId: string | null; title: string; at: string | null }

const DAY = 86_400_000;
/** ms for an ISO or SQLite "YYYY-MM-DD HH:MM:SS" (UTC) timestamp; NaN if unknown. */
export function when(v: string | null): number {
  if (!v) return NaN;
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d/.test(v) ? v.replace(" ", "T") + "Z" : v);
}
/** 0.5 ^ (age / halfLife); unknown dates count as old (0.25). */
export function decay(v: string | null, now: number, halfDays: number): number {
  const t = when(v);
  return Number.isNaN(t) ? 0.25 : Math.pow(0.5, Math.max(0, now - t) / DAY / halfDays);
}

const later = (a: string | null, b: string | null) => (Number.isNaN(when(b)) ? false : Number.isNaN(when(a)) || when(b) >= when(a));

/** Collapse rows to one per video: earliest firstAt, latest watchedAt (and its
 *  title), summed count. Newest first. Used for old duplicate rows, Takeout
 *  imports and recommend(). Mirrors the SQL backfill in librarySql.ts. */
export function mergeWatched(items: Watched[]): Watched[] {
  const by = new Map<string, Watched>();
  for (const w of items) {
    const cur = by.get(w.videoId);
    if (!cur) { by.set(w.videoId, { ...w, firstAt: w.firstAt ?? w.watchedAt }); continue; }
    const first = w.firstAt ?? w.watchedAt;
    const newer = later(cur.watchedAt, w.watchedAt);
    by.set(w.videoId, {
      videoId: w.videoId,
      channelId: (newer ? w.channelId : cur.channelId) ?? cur.channelId ?? w.channelId,
      title: newer ? w.title : cur.title,
      watchedAt: newer ? w.watchedAt : cur.watchedAt,
      firstAt: Number.isNaN(when(first)) ? cur.firstAt : Number.isNaN(when(cur.firstAt)) || when(first) <= when(cur.firstAt) ? first : cur.firstAt,
      count: cur.count + w.count,
    });
  }
  return [...by.values()].sort((a, b) => (when(b.watchedAt) || 0) - (when(a.watchedAt) || 0));
}

export interface Hidden { videos: Set<string>; channels: Set<string> }
export function hiddenOf(signals: Sig[]): Hidden {
  const h: Hidden = { videos: new Set(), channels: new Set() };
  for (const s of signals) if (s.signal === "hide") (s.kind === "video" ? h.videos : h.channels).add(s.id);
  return h;
}
export const isHidden = (h: Hidden, videoId: string, channelId: string | null) => h.videos.has(videoId) || (!!channelId && h.channels.has(channelId));
/** The user's thumb on a video, if any. */
export const ratingOf = (signals: Sig[], videoId: string): "like" | "dislike" | null =>
  signals.find((s) => s.kind === "video" && s.id === videoId && s.signal !== "hide")?.signal as "like" | "dislike" | null ?? null;
