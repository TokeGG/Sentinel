import { getDb } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { fetchFeeds, loadItems, seedPreset, setSaved, setSourceMeta } from "./store";
import { feedOps } from "./feedOps";
import { feedSections } from "./panelLogic";
import { congressModule } from "../congress/index";
import { fetchFeedsAuto, newsBadge } from "./prefsStore";

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

export const newsModule: ModuleManifest = {
  id: "hub.news",
  name: "News",
  accent: "#7bc6ff",
  ring: "daily",
  category: "news",
  icon: "news",
  description: "RSS/Atom feeds (curated sources you can check, disable or remove, plus your own) and a Congress tab (GovTrack bills, votes, members). Fetched on demand, deduped by guid.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: {
    sections: feedSections("headlines", "Headlines"),
    options: [{ key: "grouped", label: "Group duplicate stories", type: "toggle", default: true }, { key: "taste", label: "For you ordering", type: "toggle", default: true },
      { key: "headlineOnly", label: "Headline-only mode", type: "toggle", default: false },
      { key: "fontSize", label: "Article font size (px)", type: "number", default: 15, min: 11, max: 26 },
      { key: "readWidth", label: "Reading width (characters)", type: "number", default: 70, min: 40, max: 120 }],
  },
  skills: [
    { name: "add_source", run: addSource },
    { name: "fetch_feeds", run: fetchFeeds },
    { name: "fetch_feeds_auto", run: fetchFeedsAuto }, // per-source intervals; only via opt-in Auto-refresh
    { name: "set_saved", run: setSaved },
    { name: "set_source_meta", run: setSourceMeta },
    { name: "seed_preset", run: seedPreset },
    ...feedOps("news", "news_sources", "news_items"),
    ...congressModule.skills, // Congress tab (sync_congress, follow, set_seat, ...)
  ],
  // Followed bills whose status changed + unseen keyword-alert headlines (counts only).
  badge: newsBadge,
  load: loadItems,
  quickAdd: { skill: "add_source", argName: "url", placeholder: "Add an RSS/Atom feed URL…" },
  actions: [{ label: "Fetch now", skill: "fetch_feeds" }],
  schedule: { skill: "fetch_feeds_auto", intervalMinutes: 15 },
};

registerModule(newsModule);
