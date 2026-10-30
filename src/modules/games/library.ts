// Tauri I/O for Games: read manifests (Rust, read-only), local meta, launch via opener, Steam news.
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getDb } from "../../core/db";
import { parseFeed } from "../news/rss";
import { steamNewsUrl } from "./epic";
import { steamLibraries } from "./vdf";
import { mergeLibrary, newsTargets, type Game, type Meta } from "./panelLogic";
import { buildScan, type LauncherStatus, type Manifests, type SteamLib } from "./scan";

let games: Game[] = [];
let scannedAt = 0;
let lastStatus: { status: LauncherStatus[]; errors: string[] } = { status: [], errors: [] };
export const getScanStatus = () => lastStatus;

/** Full scan; a fresh result (< 3 s, e.g. Rescan followed by the panel reload) is reused. */
export async function scanLibrary(force = false): Promise<Game[]> {
  if (!force && Date.now() - scannedAt < 3000) return games;
  const m = await invoke<Manifests>("game_manifests");
  const paths = steamLibraries(m.steam_root, m.steam_libraries);
  const libs = paths.length ? await invoke<SteamLib[]>("steam_app_manifests", { libraries: paths }) : [];
  const r = buildScan(m, libs);
  const errors = [...r.errors];
  let meta: Meta[] = [];
  try { meta = await (await getDb()).select<Meta[]>("SELECT * FROM game_meta"); }
  catch (e) { errors.push(`Favourites/recent unavailable (database): ${String(e)}`); }
  games = mergeLibrary(r.steam, r.epic, meta, r.others);
  lastStatus = { status: r.status, errors };
  scannedAt = Date.now();
  return games;
}

const keyArg = (a?: Record<string, unknown>) => {
  const k = String(a?.key ?? "");
  if (!games.some((g) => g.key === k)) throw new Error("unknown game");
  return k;
};

export async function toggleFavorite(a?: Record<string, unknown>) {
  const k = keyArg(a);
  await (await getDb()).execute(
    "INSERT INTO game_meta (game_key, favorite) VALUES ($1, 1) ON CONFLICT(game_key) DO UPDATE SET favorite = 1 - favorite", [k]);
  return { ok: true };
}

export async function launch(a?: Record<string, unknown>) {
  const g = games.find((x) => x.key === keyArg(a))!;
  if (!g.uri) throw new Error(`Start ${g.name} from its own launcher (folder: ${g.path || "unknown"}).`);
  await openUrl(g.uri);
  try {
    await (await getDb()).execute(
      "INSERT INTO game_meta (game_key, last_played, plays) VALUES ($1, datetime('now'), 1) ON CONFLICT(game_key) DO UPDATE SET last_played = datetime('now'), plays = plays + 1", [g.key]);
  } catch { /* launched; only the recently-played record failed (DB table missing) */ }
  return { ok: true };
}

export async function refreshNews() {
  const d = await getDb();
  let added = 0;
  for (const appid of newsTargets(games)) {
    try {
      const res = await fetch(steamNewsUrl(appid));
      for (const it of parseFeed(await res.text()).slice(0, 10)) {
        const r = await d.execute(
          "INSERT OR IGNORE INTO game_news (appid, guid, title, link, published) VALUES ($1, $2, $3, $4, $5)",
          [appid, it.guid || it.link, it.title, it.link, it.publishedAt ?? ""]);
        added += r.rowsAffected;
      }
    } catch { /* one app's feed failing does not stop the rest */ }
  }
  return { ok: true, added };
}

export interface NewsRow { appid: string; guid: string; title: string; link: string; published: string; seen: number }
export const listNews = async (): Promise<NewsRow[]> =>
  (await getDb()).select<NewsRow[]>("SELECT * FROM game_news ORDER BY published DESC LIMIT 60");

export async function markNewsSeen() {
  await (await getDb()).execute("UPDATE game_news SET seen = 1 WHERE seen = 0");
  return { ok: true };
}

export async function unseenNews(): Promise<number> {
  const r = await (await getDb()).select<{ n: number }[]>("SELECT COUNT(*) AS n FROM game_news WHERE seen = 0");
  return r[0]?.n ?? 0;
}
