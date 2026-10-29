// Pure helpers for the YouTube panel: row splitting, embed URL, and the local
// "Recommended" ranking (no network, no model: watch affinity + title keywords).
type Row = Record<string, unknown>;

export const ytSections = [
  { id: "add", label: "Add channel" },
  { id: "recommended", label: "Recommended" },
  { id: "latest", label: "Latest videos" },
  { id: "channels", label: "Channels" },
  { id: "history", label: "Watch history & import" },
  { id: "status", label: "Refresh & auto-refresh" },
];

export interface Video { videoId: string; channelId: string; channel: string; title: string; publishedAt: string | null }
export interface Watched { videoId: string; channelId: string | null; title: string; watchedAt: string | null }
export interface Channel { channelId: string; title: string; handle: string | null }
export interface Scored extends Video { score: number; why: string }

const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "string" && v ? v : null);

/** load() returns one flat list tagged by `kind`; split it back out. */
export function splitRows(rows: Row[]) {
  const out = { videos: [] as Video[], watched: [] as Watched[], channels: [] as Channel[] };
  for (const r of rows) {
    if (r.kind === "video")
      out.videos.push({ videoId: s(r.video_id), channelId: s(r.channel_id), channel: s(r.channel_title), title: s(r.title), publishedAt: n(r.published_at) });
    else if (r.kind === "watched")
      out.watched.push({ videoId: s(r.video_id), channelId: n(r.channel_id), title: s(r.title), watchedAt: n(r.watched_at) });
    else if (r.kind === "channel") out.channels.push({ channelId: s(r.channel_id), title: s(r.title), handle: n(r.handle) });
  }
  return out;
}

/** Embed URL for a valid 11-char video id, else null. */
export function embedUrl(id: string): string | null {
  return /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
}
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

const STOP = new Set(("the and for you your with this that from are was were not but have has had how what why when who " +
  "its into out new all can will just about our their they them more most than then too very official video videos " +
  "full episode part live").split(" "));

export function tokenize(title: string): string[] {
  const t = title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  return [...new Set(t)];
}

const DAY = 86_400_000;
const when = (v: string | null) => {
  if (!v) return NaN;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2} \d/.test(v) ? v.replace(" ", "T") + "Z" : v);
  return t;
};
/** 0.5 ^ (age / halfLife); unknown dates count as old (0.25). */
function decay(v: string | null, now: number, halfDays: number): number {
  const t = when(v);
  return Number.isNaN(t) ? 0.25 : Math.pow(0.5, Math.max(0, now - t) / DAY / halfDays);
}

/** Rank UNWATCHED videos: channel affinity + keyword overlap + mild recency. */
export function recommend(videos: Video[], watched: Watched[], now = Date.now(), limit = 8): Scored[] {
  const seen = new Set(watched.map((w) => w.videoId));
  const aff = new Map<string, number>();
  const kw = new Map<string, number>();
  for (const w of watched) {
    const wt = decay(w.watchedAt, now, 30);
    if (w.channelId) aff.set(w.channelId, (aff.get(w.channelId) ?? 0) + wt);
    for (const t of tokenize(w.title)) kw.set(t, (kw.get(t) ?? 0) + wt);
  }
  const maxA = Math.max(0, ...aff.values());
  const maxK = Math.max(0, ...kw.values());
  return videos
    .filter((v) => v.videoId && !seen.has(v.videoId))
    .map((v) => {
      const a = maxA ? (aff.get(v.channelId) ?? 0) / maxA : 0;
      const toks = tokenize(v.title);
      const k = maxK && toks.length ? toks.reduce((x, t) => x + (kw.get(t) ?? 0) / maxK, 0) / toks.length : 0;
      const score = 2 * a + 1.5 * k + 0.4 * decay(v.publishedAt, now, 7);
      return { ...v, score, why: a >= k && a > 0 ? "a channel you watch" : k > 0 ? "similar to what you watched" : "new" };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
