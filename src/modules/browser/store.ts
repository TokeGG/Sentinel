// SQLite side of the browser (migration 43) + its app_settings keys:
// `browser_engine` (search engine), `links_open_in` (app | system; read by ui/safeLink).
import { getDb } from "../../core/db";
import { getSetting, setSetting } from "../../ui/appSetting";
import { DEFAULT_APPS, HISTORY_CAP } from "./layout";
import { isEngine, isWebUrl, type Engine } from "./url";
import type { ImportedBookmark } from "./opera";

export type Bookmark = { id: number; url: string; title: string; folder: string; bar: number };
export type HistoryRow = { id: number; url: string; title: string; visited: string };
export type WebApp = { id: number; name: string; url: string; pos: number };

export const listBookmarks = async () => (await getDb()).select<Bookmark[]>("SELECT id, url, title, folder, bar FROM browser_bookmarks ORDER BY folder, id");
export async function addBookmark(url: string, title: string, folder = "", bar = true): Promise<void> {
  if (!isWebUrl(url)) throw new Error("only http(s) links can be bookmarked");
  await (await getDb()).execute("INSERT OR IGNORE INTO browser_bookmarks (url, title, folder, bar) VALUES ($1, $2, $3, $4)", [url, title.slice(0, 300), folder.slice(0, 200), bar ? 1 : 0]);
}
export const removeBookmark = async (id: number) => { await (await getDb()).execute("DELETE FROM browser_bookmarks WHERE id = $1", [id]); };
export const renameBookmark = async (id: number, title: string, folder: string) => {
  await (await getDb()).execute("UPDATE browser_bookmarks SET title = $2, folder = $3 WHERE id = $1", [id, title.slice(0, 300), folder.slice(0, 200)]);
};
export async function importBookmarks(list: ImportedBookmark[], prefix: string): Promise<number> {
  let n = 0;
  for (const b of list) {
    await addBookmark(b.url, b.title, [prefix, b.folder].filter(Boolean).join("/"), b.bar);
    n++;
  }
  return n;
}

/** Record a visit (never for private tabs: callers skip them) and keep at most HISTORY_CAP rows. */
export async function addHistory(url: string, title: string): Promise<void> {
  if (!isWebUrl(url)) return;
  const d = await getDb();
  await d.execute("INSERT INTO browser_history (url, title) VALUES ($1, $2)", [url, title.slice(0, 300)]);
  await d.execute("DELETE FROM browser_history WHERE id <= (SELECT id FROM browser_history ORDER BY id DESC LIMIT 1 OFFSET $1)", [HISTORY_CAP]);
}
export const setHistoryTitle = async (url: string, title: string) => {
  await (await getDb()).execute("UPDATE browser_history SET title = $2 WHERE id = (SELECT MAX(id) FROM browser_history WHERE url = $1)", [url, title.slice(0, 300)]);
};
export const listHistory = async (q = "", limit = 300) => (await getDb()).select<HistoryRow[]>(
  "SELECT id, url, title, visited FROM browser_history WHERE url LIKE $1 OR title LIKE $1 ORDER BY id DESC LIMIT $2", [`%${q}%`, limit]);
export const clearHistory = async () => { await (await getDb()).execute("DELETE FROM browser_history"); };

/** Sidebar web apps; seeded once with the defaults when the table is empty and never seeded before. */
export async function listApps(): Promise<WebApp[]> {
  const d = await getDb();
  let rows = await d.select<WebApp[]>("SELECT id, name, url, pos FROM browser_apps ORDER BY pos, id");
  if (rows.length === 0 && (await getSetting("browser_apps_seeded")) !== "1") {
    for (const [i, a] of DEFAULT_APPS.entries()) await d.execute("INSERT OR IGNORE INTO browser_apps (name, url, pos) VALUES ($1, $2, $3)", [a.name, a.url, i]);
    await setSetting("browser_apps_seeded", "1");
    rows = await d.select<WebApp[]>("SELECT id, name, url, pos FROM browser_apps ORDER BY pos, id");
  }
  return rows;
}
export async function addApp(name: string, url: string): Promise<void> {
  if (!isWebUrl(url)) throw new Error("web apps need an http(s) address");
  await (await getDb()).execute("INSERT OR IGNORE INTO browser_apps (name, url, pos) VALUES ($1, $2, (SELECT COALESCE(MAX(pos), 0) + 1 FROM browser_apps))", [name.slice(0, 40) || url, url]);
}
export const removeApp = async (id: number) => { await (await getDb()).execute("DELETE FROM browser_apps WHERE id = $1", [id]); };

export const getEngine = async (): Promise<Engine> => { const v = await getSetting("browser_engine"); return isEngine(v) ? v : "duckduckgo"; };
export const setEngine = (e: Engine) => setSetting("browser_engine", e);
export const getLinksOpenIn = async (): Promise<"app" | "system"> => ((await getSetting("links_open_in")) === "system" ? "system" : "app");
export const setLinksOpenIn = (v: "app" | "system") => setSetting("links_open_in", v);
