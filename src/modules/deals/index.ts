import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { feedSections } from "../news/panelLogic";
import { parseFeed } from "../news/rss"; // deals sources are RSS/Atom too — same parser, no duplication

interface DealItem extends Record<string, unknown> {
  id: number;
  source_id: number;
  title: string;
  link: string;
  published_at: string | null;
  label: string | null;
}

async function addSource(args?: Record<string, unknown>) {
  const url = String(args?.url ?? "").trim();
  if (!url) throw new Error("feed url is empty");
  const d = await getDb();
  await d.execute(
    "INSERT OR IGNORE INTO deal_sources (url, label) VALUES ($1, $2)",
    [url, args?.label ? String(args.label) : null]
  );
  return { ok: true };
}

async function fetchDeals() {
  const d = await getDb();
  const sources = await d.select<{ id: number; url: string }[]>(
    "SELECT id, url FROM deal_sources"
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
          `INSERT OR IGNORE INTO deal_offers (source_id, guid, title, link, published_at)
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
    "deals",
    "check_source",
    `checked ${sources.length} source(s)`,
    `${added} new offer(s)${failed ? `, ${failed} source(s) failed` : ""}`
  );
  return { added, failed };
}

async function loadItems(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  return await d.select<DealItem[]>(`
    SELECT deal_offers.*, deal_sources.label, deal_sources.url AS source_url
    FROM deal_offers
    JOIN deal_sources ON deal_sources.id = deal_offers.source_id
    ORDER BY COALESCE(published_at, fetched_at) DESC
    LIMIT 200
  `);
}

export const dealsModule: ModuleManifest = {
  id: "hub.deals",
  name: "Deals & Promos",
  accent: "#ff9a4d",
  ring: "daily",
  icon: "deals",
  description: "RSS/Atom deal feeds you add — same fetch+dedupe pattern as News.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: {
    sections: feedSections("deals", "Deals"),
  },
  skills: [
    { name: "check_source", run: addSource },
    { name: "fetch_deals", run: fetchDeals },
  ],
  load: loadItems,
  quickAdd: { skill: "check_source", argName: "url", placeholder: "Add a deal feed URL…" },
  actions: [{ label: "Check sources", skill: "fetch_deals" }],
  schedule: { skill: "fetch_deals", intervalMinutes: 60 },
};

registerModule(dealsModule);
