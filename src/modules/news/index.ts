import { getDb } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";
import { fetchFeeds, loadItems, seedPreset, setSaved, setSourceMeta } from "./store";
import { feedOps } from "./feedOps";
import { feedSections } from "./panelLogic";

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
  icon: "news",
  description: "RSS/Atom feeds you add — fetched on demand, deduped by guid.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: {
    sections: feedSections("headlines", "Headlines"),
    options: [{ key: "grouped", label: "Group duplicate stories", type: "toggle", default: true }, { key: "taste", label: "For you ordering", type: "toggle", default: true }],
  },
  skills: [
    { name: "add_source", run: addSource },
    { name: "fetch_feeds", run: fetchFeeds },
    { name: "set_saved", run: setSaved },
    { name: "set_source_meta", run: setSourceMeta },
    { name: "seed_preset", run: seedPreset },
    ...feedOps("news", "news_sources", "news_items"),
  ],
  load: loadItems,
  quickAdd: { skill: "add_source", argName: "url", placeholder: "Add an RSS/Atom feed URL…" },
  actions: [{ label: "Fetch now", skill: "fetch_feeds" }],
  schedule: { skill: "fetch_feeds", intervalMinutes: 30 },
};

registerModule(newsModule);
