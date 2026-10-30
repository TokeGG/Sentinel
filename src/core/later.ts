// Cross-panel Read later (Terminal `later` box/command, briefing): reads the three existing stores.
import { getDb } from "./db";
import { mergeLater, type LaterItem } from "./laterLogic";

export async function listLater(max = 50): Promise<LaterItem[]> {
  const d = await getDb();
  const q = <T,>(sql: string) => d.select<T[]>(sql).catch(() => [] as T[]);
  const [news, videos, links] = await Promise.all([
    q<{ title: string; link: string; saved_at: string }>("SELECT i.title, i.link, v.saved_at FROM news_saved v JOIN news_items i ON i.id = v.item_id WHERE v.later = 1"),
    q<{ video_id: string; title: string; added_at: string }>("SELECT video_id, title, added_at FROM youtube_later"),
    q<{ url: string; title: string; saved_at: string }>("SELECT url, title, saved_at FROM bookmarks WHERE read = 0"),
  ]);
  return mergeLater(news, videos, links, max);
}
