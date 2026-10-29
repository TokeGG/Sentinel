// Deals DB access: sources with category/enabled (deal_source_meta), seeding, offers.
import { getDb } from "../../core/db";
import { categoryOk } from "./defaults";
import { seedMissing } from "./seed";
import { loadState } from "../news/sources/store";

let seeding: Promise<number> | null = null;
/** Adds missing curated deal feeds once per app run. */
export function seedDeals(): Promise<number> {
  seeding ??= (async () => seedMissing(await getDb(), await loadState("deals")))().catch((e) => { seeding = null; throw e; });
  return seeding;
}
import { decorate } from "./extraStore";

export interface DealSource extends Record<string, unknown> { id: number; url: string; label: string | null; category: string; enabled: number }

export async function listDealSources(): Promise<DealSource[]> {
  await seedDeals().catch(() => {});
  const d = await getDb();
  return d.select<DealSource[]>(`
    SELECT s.id, s.url, s.label, COALESCE(m.category, 'general') AS category, COALESCE(m.enabled, 1) AS enabled
    FROM deal_sources s LEFT JOIN deal_source_meta m ON m.url = s.url ORDER BY s.id`);
}

export async function addSource(args?: Record<string, unknown>) {
  const url = String(args?.url ?? "").trim();
  if (!url) throw new Error("feed url is empty");
  const cat = categoryOk(args?.category) ? args?.category : "general";
  const d = await getDb();
  await d.execute("INSERT OR IGNORE INTO deal_sources (url, label) VALUES ($1, $2)", [url, args?.label ? String(args.label) : null]);
  await d.execute("INSERT OR IGNORE INTO deal_source_meta (url, category, enabled) VALUES ($1, $2, 1)", [url, cat]);
  return { ok: true };
}

export async function setSource(args?: Record<string, unknown>) {
  const id = Number(args?.id);
  if (!Number.isInteger(id)) throw new Error("id is required");
  const d = await getDb();
  const s = (await d.select<{ url: string }[]>("SELECT url FROM deal_sources WHERE id = $1", [id]))[0];
  if (!s) throw new Error("no such source");
  await d.execute("INSERT OR IGNORE INTO deal_source_meta (url) VALUES ($1)", [s.url]);
  if (typeof args?.enabled === "boolean") await d.execute("UPDATE deal_source_meta SET enabled = $2 WHERE url = $1", [s.url, args.enabled ? 1 : 0]);
  if (categoryOk(args?.category)) await d.execute("UPDATE deal_source_meta SET category = $2 WHERE url = $1", [s.url, args.category]);
  return { ok: true };
}

/** Offers of enabled sources, newest first, each with its source label and category. */
export async function loadDeals(): Promise<Record<string, unknown>[]> {
  await seedDeals().catch(() => {});
  const d = await getDb();
  return decorate(await d.select(`
    SELECT o.*, s.label, s.url AS source_url, COALESCE(m.category, 'general') AS category
    FROM deal_offers o JOIN deal_sources s ON s.id = o.source_id
    LEFT JOIN deal_source_meta m ON m.url = s.url
    WHERE COALESCE(m.enabled, 1) = 1
    ORDER BY COALESCE(o.published_at, o.fetched_at) DESC LIMIT 200`));
}
