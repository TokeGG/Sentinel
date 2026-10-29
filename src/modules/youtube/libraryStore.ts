// DB side of the local library: one-row-per-video history (youtube_seen),
// the watch-later queue and the like / dislike / not-interested signals.
import { getDb, logActivity } from "../../core/db";
import { BACKFILL_SQL, IMPORT_SQL, PLAY_SQL } from "./librarySql";
import { parseTakeout, mergeTakeout } from "./takeout";

type Row = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");
const opt = (v: unknown) => (v ? String(v) : null);

// Fold the old duplicate-prone youtube_watched rows into youtube_seen once per
// process (idempotent: existing youtube_seen rows win).
let ready: Promise<void> | null = null;
async function ensureLibrary() {
  ready ??= getDb().then((d) => d.execute(BACKFILL_SQL)).then(() => undefined, (e) => { ready = null; throw e; });
  await ready;
}

export async function markWatched(args?: Row) {
  await ensureLibrary();
  const id = str(args?.videoId);
  if (!id) return { ok: true };
  await (await getDb()).execute(PLAY_SQL, [id, opt(args?.channelId), str(args?.title)]);
  return { ok: true };
}

export async function clearHistory() {
  await ensureLibrary();
  const d = await getDb();
  await d.execute("DELETE FROM youtube_seen");
  await d.execute("DELETE FROM youtube_watched");
  await logActivity("youtube", "clear_history", "watch history cleared", "ok");
  return { ok: true };
}

export async function importHistory(args?: Row) {
  const items = mergeTakeout(parseTakeout(str(args?.text)));
  await ensureLibrary();
  const d = await getDb();
  for (const w of items) await d.execute(IMPORT_SQL, [w.videoId, w.channelId, w.title, w.firstAt, w.watchedAt, w.count]);
  await logActivity("youtube", "import_history", "Takeout watch history", `${items.length} video(s)`);
  return { ok: true, count: items.length };
}

export async function addLater(args?: Row) {
  await (await getDb()).execute("INSERT OR IGNORE INTO youtube_later (video_id, channel_id, title) VALUES ($1, $2, $3)", [str(args?.videoId), opt(args?.channelId), str(args?.title)]);
  return { ok: true };
}
export async function removeLater(args?: Row) {
  await (await getDb()).execute("DELETE FROM youtube_later WHERE video_id = $1", [str(args?.videoId)]);
  return { ok: true };
}

/** kind video|channel, signal like|dislike|hide. A thumb replaces the opposite thumb; hiding a video drops it from the queue. */
export async function setSignal(args?: Row) {
  const kind = args?.kind === "channel" ? "channel" : "video";
  const signal = args?.signal === "like" || args?.signal === "dislike" ? args.signal : "hide";
  const id = str(args?.id);
  if (!id) return { ok: true };
  const d = await getDb();
  if (signal !== "hide") await d.execute("DELETE FROM youtube_signal WHERE target_kind = 'video' AND target_id = $1 AND signal IN ('like', 'dislike')", [id]);
  await d.execute("INSERT OR REPLACE INTO youtube_signal (target_kind, target_id, signal, channel_id, title) VALUES ($1, $2, $3, $4, $5)", [kind, id, signal, opt(args?.channelId), str(args?.title)]);
  if (signal === "hide" && kind === "video") await d.execute("DELETE FROM youtube_later WHERE video_id = $1", [id]);
  return { ok: true };
}
export async function clearSignal(args?: Row) {
  const sig = args?.signal ? str(args.signal) : null;
  await (await getDb()).execute("DELETE FROM youtube_signal WHERE target_kind = $1 AND target_id = $2 AND ($3 IS NULL OR signal = $3)", [str(args?.kind), str(args?.id), sig]);
  return { ok: true };
}
export async function clearHidden() {
  await (await getDb()).execute("DELETE FROM youtube_signal WHERE signal = 'hide'");
  return { ok: true };
}

export async function libraryRows(): Promise<Row[]> {
  await ensureLibrary();
  const d = await getDb();
  const [seen, later, sig] = await Promise.all([
    d.select<Row[]>("SELECT * FROM youtube_seen ORDER BY last_at DESC LIMIT 1000"),
    d.select<Row[]>("SELECT * FROM youtube_later ORDER BY added_at DESC"),
    d.select<Row[]>("SELECT * FROM youtube_signal ORDER BY at DESC"),
  ]);
  return [...seen.map((r) => ({ ...r, kind: "watched" })), ...later.map((r) => ({ ...r, kind: "later" })), ...sig.map((r) => ({ ...r, kind: "signal" }))];
}
