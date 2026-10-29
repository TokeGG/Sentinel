import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { addCoupon, addWish, markWishesSeen, onNewOffer, removeCoupon, removeWish, unseenWishHits } from "./extraStore";
import { addSource, listDealSources, loadDeals, setSource } from "./store";
import { feedOps } from "../news/feedOps";
import { feedSections } from "../news/panelLogic";
import { parseFeed } from "../news/rss"; // deals sources are RSS/Atom too — same parser, no duplication

async function fetchDeals() {
  const d = await getDb();
  const sources = (await listDealSources()).filter((s) => s.enabled);

  let added = 0;
  let failed = 0;
  for (const source of sources) {
    try {
      const res = await fetch(source.url);
      const xml = await res.text();
      const items = parseFeed(xml);
      for (const item of items) {
        const result = await d.execute(
          `INSERT OR IGNORE INTO deal_offers (source_id, guid, title, link, published_at) VALUES ($1, $2, $3, $4, $5)`,
          [source.id, item.guid, item.title, item.link, item.publishedAt]
        );
        if (result.rowsAffected > 0) {
          added++;
          await onNewOffer(d, Number(result.lastInsertId), item.title, item.summary ?? "", source.label ?? source.url);
        }
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

export const dealsModule: ModuleManifest = {
  id: "hub.deals",
  name: "Deals & Promos",
  accent: "#ea9603",
  ring: "daily",
  icon: "deals",
  description: "Preloaded RSS/Atom deal feeds (toggle or add your own), ordered For you by what you like and dislike. Fetches only when you press Check sources or opt in to auto-refresh.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: {
    sections: feedSections("deals", "Deals"),
    options: [{ key: "taste", label: "For you ordering", type: "toggle", default: true }],
  },
  skills: [
    { name: "check_source", run: addSource },
    { name: "fetch_deals", run: fetchDeals },
    { name: "deal_sources", run: listDealSources },
    { name: "set_source", run: setSource },
    { name: "add_wish", run: addWish },
    { name: "remove_wish", run: removeWish },
    { name: "mark_wishes_seen", run: markWishesSeen },
    { name: "add_coupon", run: addCoupon },
    { name: "remove_coupon", run: removeCoupon },
    ...feedOps("deals", "deal_sources", "deal_offers"),
  ],
  load: loadDeals,
  // New deals matching a wishlist entry (counts only).
  badge: unseenWishHits,
  quickAdd: { skill: "check_source", argName: "url", placeholder: "Add a deal feed URL…" },
  actions: [{ label: "Check sources", skill: "fetch_deals" }],
  schedule: { skill: "fetch_deals", intervalMinutes: 60 },
};

registerModule(dealsModule);
