// News SQLite side: fetch (items + audio enclosures), the item list with source tag/reliability and
// read-later/highlight state, followed topics and opt-in preset feeds (tables from migration 39).
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { cleanTopic, PRESETS, reliabilityOk } from "./extras";
import { parseFeed } from "./rss";

export async function fetchFeeds() {
  const d = await getDb();
  const sources = await d.select<{ id: number; url: string }[]>("SELECT id, url FROM news_sources");
  let added = 0;
  let failed = 0;
  for (const source of sources) {
    try {
      const items = parseFeed(await (await fetch(source.url)).text());
      for (const item of items) {
        const result = await d.execute(
          `INSERT OR IGNORE INTO news_items (source_id, guid, title, link, published_at) VALUES ($1, $2, $3, $4, $5)`,
          [source.id, item.guid, item.title, item.link, item.publishedAt]
        );
        if (result.rowsAffected > 0) added++;
        if (item.enclosure)
          await d.execute("INSERT OR IGNORE INTO news_enclosures (source_id, guid, url, type) VALUES ($1,$2,$3,$4)", [source.id, item.guid, item.enclosure.url, item.enclosure.type]);
      }
    } catch {
      failed++;
    }
  }
  await logActivity("news", "fetch_feeds", `checked ${sources.length} source(s)`, `${added} new item(s)${failed ? `, ${failed} source(s) failed` : ""}`);
  return { added, failed };
}

/** Newest 200 items plus every saved (read-later/highlighted) one. */
export async function loadItems(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  return d.select(`
    SELECT i.*, s.label, s.url AS source_url, COALESCE(m.tag, '') AS tag, COALESCE(m.reliability, '') AS reliability,
      COALESCE(v.later, 0) AS later, COALESCE(v.highlight, '') AS highlight, e.url AS audio_url, e.type AS audio_type
    FROM news_items i JOIN news_sources s ON s.id = i.source_id
    LEFT JOIN news_source_meta m ON m.source_id = s.id
    LEFT JOIN news_saved v ON v.item_id = i.id
    LEFT JOIN news_enclosures e ON e.source_id = i.source_id AND e.guid = i.guid
    WHERE i.id IN (SELECT id FROM news_items ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT 200) OR v.item_id IS NOT NULL
    ORDER BY COALESCE(i.published_at, i.fetched_at) DESC`);
}

export async function listTopics(): Promise<string[]> {
  const d = await getDb();
  return (await d.select<{ term: string }[]>("SELECT term FROM news_topics ORDER BY term")).map((r) => r.term);
}

export async function addTopic(raw: string): Promise<string> {
  const t = cleanTopic(raw);
  if (!t) throw new Error("topic must be 2-40 characters");
  await (await getDb()).execute("INSERT OR IGNORE INTO news_topics (term) VALUES ($1)", [t]);
  return t;
}

export const removeTopic = async (t: string) => void (await (await getDb()).execute("DELETE FROM news_topics WHERE term = $1", [t]));

export async function setSourceMeta(args?: Record<string, unknown>) {
  const id = Number(args?.id);
  if (!Number.isInteger(id)) throw new Error("source id missing");
  const tag = String(args?.tag ?? "").trim().toLowerCase().slice(0, 30);
  const rel = reliabilityOk(args?.reliability) ? args?.reliability : "";
  await (await getDb()).execute(
    "INSERT INTO news_source_meta (source_id, tag, reliability) VALUES ($1,$2,$3) ON CONFLICT(source_id) DO UPDATE SET tag = $2, reliability = $3", [id, tag, rel]);
  return { ok: true };
}

export async function listSourceMeta(): Promise<{ id: number; url: string; label: string | null; tag: string; reliability: string }[]> {
  return (await getDb()).select(`SELECT s.id, s.url, s.label, COALESCE(m.tag,'') AS tag, COALESCE(m.reliability,'') AS reliability
    FROM news_sources s LEFT JOIN news_source_meta m ON m.source_id = s.id ORDER BY s.id`);
}

/** Read later on/off and/or a highlight note; a row with neither is removed. */
export async function setSaved(args?: Record<string, unknown>) {
  const id = Number(args?.id);
  if (!Number.isInteger(id)) throw new Error("item id missing");
  const later = args?.later ? 1 : 0;
  const hl = String(args?.highlight ?? "").trim().slice(0, 1000);
  const d = await getDb();
  if (!later && !hl) await d.execute("DELETE FROM news_saved WHERE item_id = $1", [id]);
  else await d.execute("INSERT INTO news_saved (item_id, later, highlight) VALUES ($1,$2,$3) ON CONFLICT(item_id) DO UPDATE SET later = $2, highlight = $3", [id, later, hl]);
  return { ok: true };
}

/** Opt-in: adds a preset's feeds tagged with its tag (nothing is fetched until Fetch/auto-refresh). */
export async function seedPreset(args?: Record<string, unknown>) {
  const p = PRESETS[String(args?.preset ?? "")];
  if (!p) throw new Error("unknown preset");
  const d = await getDb();
  for (const f of p.feeds) {
    await d.execute("INSERT OR IGNORE INTO news_sources (url, label) VALUES ($1, $2)", [f.url, f.label]);
    await d.execute(`INSERT OR IGNORE INTO news_source_meta (source_id, tag) SELECT id, $2 FROM news_sources WHERE url = $1`, [f.url, p.tag]);
  }
  await logActivity("news", "seed_preset", p.label, `${p.feeds.length} feed(s)`);
  return { ok: true };
}
