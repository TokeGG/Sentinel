import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { parseFeed } from "./rss";

interface NewsItem extends Record<string, unknown> {
  id: number;
  source_id: number;
  title: string;
  link: string;
  published_at: string | null;
  fetched_at: string;
  label: string | null;
}

async function addSource(args?: Record<string, unknown>) {
  const url = String(args?.url ?? "").trim();
  if (!url) throw new Error("feed url is empty");
  const d = await getDb();
  await d.execute(
    "INSERT OR IGNORE INTO news_sources (url, label) VALUES ($1, $2)",
    [url, args?.label ? String(args.label) : null]
  );
  return { ok: true };
}

async function fetchFeeds() {
  const d = await getDb();
  const sources = await d.select<{ id: number; url: string }[]>(
    "SELECT id, url FROM news_sources"
  );

  let added = 0;
  let failed = 0;
  for (const source of sources) {
    try {
      const res = await fetch(source.url);
      const xml = await res.text();
      const items = parseFeed(xml);
      for (const item of items) {
        const result = await d.execute(
          `INSERT OR IGNORE INTO news_items (source_id, guid, title, link, published_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [source.id, item.guid, item.title, item.link, item.publishedAt]
        );
        if (result.rowsAffected > 0) added++;
      }
    } catch {
      failed++;
    }
  }

  await logActivity(
    "news",
    "fetch_feeds",
    `checked ${sources.length} source(s)`,
    `${added} new item(s)${failed ? `, ${failed} source(s) failed` : ""}`
  );
  return { added, failed };
}

async function loadItems(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  return await d.select<NewsItem[]>(`
    SELECT news_items.*, news_sources.label
    FROM news_items
    JOIN news_sources ON news_sources.id = news_items.source_id
    ORDER BY COALESCE(published_at, fetched_at) DESC
    LIMIT 200
  `);
}

export const newsModule: ModuleManifest = {
  id: "hub.news",
  name: "News",
  description: "RSS/Atom feeds you add — fetched on demand, deduped by guid.",
  panel: "list",
  skills: [
    { name: "add_source", run: addSource },
    { name: "fetch_feeds", run: fetchFeeds },
  ],
  load: loadItems,
  quickAdd: { skill: "add_source", argName: "url", placeholder: "Add an RSS/Atom feed URL…" },
  actions: [{ label: "Fetch now", skill: "fetch_feeds" }],
  schedule: { skill: "fetch_feeds", intervalMinutes: 30 },
};

registerModule(newsModule);
