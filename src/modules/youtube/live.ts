// Pure live detection: parses https://www.youtube.com/channel/<id>/live. Feeds never flag live,
// but that page's canonical link points at the live (or scheduled) watch?v= video.
export type LiveStatus = "live" | "upcoming";
export interface LiveHit { channelId: string; videoId: string; status: LiveStatus; title: string; startsAt: number | null; checkedAt: number }
export const LIVE_KEY = "yt_live";
export const liveUrl = (channelId: string) => `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/live`;

const unesc = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** -> { videoId, status, title, startsAt } or null when the channel is not live / scheduled. */
export function parseLivePage(html: string): Omit<LiveHit, "channelId" | "checkedAt"> | null {
  const canon = /<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/.exec(html);
  if (!canon) return null;
  const live = /"isLiveNow"\s*:\s*true/.test(html) || /"isLive"\s*:\s*true/.test(html);
  const upcoming = /"isUpcoming"\s*:\s*true/.test(html) || /"upcomingEventData"/.test(html);
  if (!live && !upcoming) return null;
  const t = /<meta\s+name="title"\s+content="([^"]*)"/.exec(html) ?? /<meta\s+property="og:title"\s+content="([^"]*)"/.exec(html);
  const s = /"scheduledStartTime"\s*:\s*"(\d+)"/.exec(html);
  return { videoId: canon[1], status: live ? "live" : "upcoming", title: t ? unesc(t[1]) : "", startsAt: !live && s ? Number(s[1]) : null };
}

/** Stored JSON -> hits (live first, then soonest upcoming). */
export function sanitizeLive(raw: string | null): LiveHit[] {
  let v: unknown;
  try { v = raw ? JSON.parse(raw) : []; } catch { return []; }
  if (!Array.isArray(v)) return [];
  return v.filter((h) => h && /^[\w-]{11}$/.test(h.videoId) && (h.status === "live" || h.status === "upcoming") && typeof h.channelId === "string")
    .map((h) => ({ channelId: h.channelId, videoId: h.videoId, status: h.status, title: String(h.title ?? ""), startsAt: Number(h.startsAt) || null, checkedAt: Number(h.checkedAt) || 0 }))
    .sort((a, b) => (a.status === b.status ? (a.startsAt ?? 0) - (b.startsAt ?? 0) : a.status === "live" ? -1 : 1));
}
