import { registerModule, type ModuleManifest } from "../../core/module";
import { openLink } from "../../ui/openLink";
import { listBookmarks, listHistory } from "./store";

// In-app browser (Opera-like): tabs as Rust child webviews (panels/browser.rs) on one
// persistent profile `browser`, bookmarks/history/web-app sidebar in SQLite (migration 43).
// Every app link opens here by default (ui/openLink.ts, setting `links_open_in`).
export const browserModule: ModuleManifest = {
  id: "hub.browser",
  name: "Browser",
  accent: "#00bb44",
  ring: "daily",
  icon: "browser",
  description: "Built-in browser with tabs, bookmarks, history, downloads and pinned web apps.",
  panel: "custom",
  ui: () => import("./Panel"),
  skills: [{ name: "open_url", run: async (a) => { await openLink((a as { url?: string })?.url, "app"); return { ok: true }; } }],
  load: async () => (await listBookmarks()).map((b) => ({ id: String(b.id), title: b.title || b.url, link: b.url, subtitle: b.folder })),
  search: async (q) => {
    const like = q.toLowerCase();
    const bm = (await listBookmarks()).filter((b) => (b.title + b.url).toLowerCase().includes(like)).slice(0, 8);
    const hi = (await listHistory(q, 8));
    return [...bm.map((b) => ({ title: b.title || b.url, subtitle: b.url })), ...hi.map((h) => ({ title: h.title || h.url, subtitle: h.url }))];
  },
};

registerModule(browserModule);
