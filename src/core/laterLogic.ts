// Pure cross-panel Read later: merges News read-later, YouTube Watch later and Calendar
// bookmarks (unread) into one list, newest first. Rows come straight from SQLite.
export type LaterItem = { kind: "news" | "video" | "link"; title: string; url: string; at: string };

export function mergeLater(news: { title: string; link: string; saved_at: string }[], videos: { video_id: string; title: string; added_at: string }[],
  links: { url: string; title: string; saved_at: string }[], max = 50): LaterItem[] {
  return [
    ...news.map((n) => ({ kind: "news" as const, title: n.title, url: n.link, at: n.saved_at })),
    ...videos.map((v) => ({ kind: "video" as const, title: v.title, url: `https://www.youtube.com/watch?v=${encodeURIComponent(v.video_id)}`, at: v.added_at })),
    ...links.map((l) => ({ kind: "link" as const, title: l.title || l.url, url: l.url, at: l.saved_at })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, max);
}
