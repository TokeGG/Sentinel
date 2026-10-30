import { registerModule, type ModuleManifest } from "../../core/module";
import { launch, listNews, markNewsSeen, refreshNews, scanLibrary, toggleFavorite, unseenNews } from "./library";
import { gamesSections } from "./panelLogic";

// Game library launcher: Steam + Epic installs (read-only), launch through the store's own URI,
// favourites/recently played, Steam patch notes per app. Nothing runs without a click or opt-in schedule.
export const gamesModule: ModuleManifest = {
  id: "hub.games",
  name: "Games",
  accent: "#0077ee",
  ring: "media",
  category: "media",
  icon: "games",
  description: "Your installed Steam, Epic, GOG, Ubisoft, Battle.net and EA games, launch, favourites and patch notes.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: gamesSections, options: [{ key: "matchHours", label: "CS2 match counts as live for (hours)", type: "number", default: 3, min: 1, max: 12 }] },
  skills: [
    { name: "scan", run: async () => ({ ok: true, count: (await scanLibrary(true)).length }) },
    { name: "launch", run: launch },
    { name: "toggle_favorite", run: toggleFavorite },
    { name: "refresh_news", run: refreshNews },
    { name: "list_news", run: listNews },
    { name: "mark_news_seen", run: markNewsSeen },
  ],
  load: async () => (await scanLibrary()).map((g) => ({ ...g, id: g.key, title: g.name })),
  actions: [{ label: "Check patch notes", skill: "refresh_news" }],
  schedule: { skill: "refresh_news", intervalMinutes: 180 },
  badge: unseenNews,
};

registerModule(gamesModule);
