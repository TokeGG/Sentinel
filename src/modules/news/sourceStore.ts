// News source catalog on SQLite: seed missing curated feeds (tag = category), list with check status,
// enable/disable and remove (a removed catalog feed is remembered so seeding never re-adds it).
import { getDb, logActivity } from "../../core/db";
import { NEWS_CATALOG } from "./catalog/index";
import { mergeRows, seedPlan, type SrcRow } from "./sources/logic";
import { checkSources, loadState, patchState } from "./sources/store";

const KIND = "news";
let seeding: Promise<number> | null = null;

/** Adds catalog feeds that are missing (once per app run; idempotent). */
export function seedNewsCatalog(): Promise<number> {
  seeding ??= (async () => {
    const d = await getDb();
    const have = (await d.select<{ url: string }[]>("SELECT url FROM news_sources")).map((r) => r.url);
    const plan = seedPlan(NEWS_CATALOG, have, await loadState(KIND));
    for (const c of plan) {
      await d.execute("INSERT OR IGNORE INTO news_sources (url, label) VALUES ($1, $2)", [c.url, c.label]);
      await d.execute("INSERT OR IGNORE INTO news_source_meta (source_id, tag) SELECT id, $2 FROM news_sources WHERE url = $1", [c.url, c.category]);
    }
    if (plan.length) await logActivity("news", "seed_catalog", "curated feeds (unverified)", `${plan.length} added`);
    return plan.length;
  })().catch((e) => { seeding = null; throw e; });
  return seeding;
}

export async function listNewsSources(): Promise<SrcRow[]> {
  await seedNewsCatalog();
  const rows = await (await getDb()).select<{ id: number; url: string; label: string | null; category: string }[]>(
    "SELECT s.id, s.url, s.label, COALESCE(NULLIF(m.tag, ''), 'other') AS category FROM news_sources s LEFT JOIN news_source_meta m ON m.source_id = s.id ORDER BY s.id");
  return mergeRows(rows, await loadState(KIND));
}

/** Urls of sources the user has not switched off. */
export async function enabledNewsSources(): Promise<{ id: number; url: string }[]> {
  const off = await loadState(KIND);
  const all = await (await getDb()).select<{ id: number; url: string }[]>("SELECT id, url FROM news_sources");
  return all.filter((s) => !off[s.url]?.off);
}

export const setNewsEnabled = (r: SrcRow, on: boolean) => patchState(KIND, r.url, { off: !on });

export async function removeNewsSource(r: SrcRow): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM news_items WHERE source_id = $1", [r.id]);
  await d.execute("DELETE FROM news_source_meta WHERE source_id = $1", [r.id]);
  await d.execute("DELETE FROM news_sources WHERE id = $1", [r.id]);
  await patchState(KIND, r.url, { removed: true });
}

export const checkNewsSources = (urls: string[]) => checkSources(KIND, urls);
