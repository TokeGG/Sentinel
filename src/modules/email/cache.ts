// SQLite cache of folders, headers and bodies for fast open and offline reading.
// Never holds credentials. Bodies are stored as the parsed JSON from Rust (HTML
// unsanitized; it is sanitized at display time).
import { getDb } from "../../core/db";
import { sortFolders } from "./folders.ts";
import type { Body, Folder, Msg, Role } from "./types.ts";

interface MRow { account_id: string; folder: string; uid: number; from_name: string; from_addr: string; to_addrs: string; subject: string; preview: string; date_ts: number; seen: number; starred: number; answered: number; has_attach: number }
const toMsg = (r: MRow): Msg => ({ accountId: r.account_id, folder: r.folder, uid: r.uid, fromName: r.from_name, fromAddr: r.from_addr, to: r.to_addrs, subject: r.subject, preview: r.preview, dateTs: r.date_ts, seen: !!r.seen, starred: !!r.starred, answered: !!r.answered, hasAttach: !!r.has_attach });

export async function saveFolders(accountId: string, fs: Folder[]) {
  const d = await getDb();
  await d.execute("DELETE FROM mail_folders WHERE account_id = $1", [accountId]);
  for (const f of fs) await d.execute("INSERT OR REPLACE INTO mail_folders (account_id,name,role) VALUES ($1,$2,$3)", [accountId, f.name, f.role]);
}
export async function cachedFolders(accountId: string): Promise<Folder[]> {
  const d = await getDb();
  const r = await d.select<{ name: string; role: string }[]>("SELECT name, role FROM mail_folders WHERE account_id = $1", [accountId]);
  return sortFolders(r.map((x) => ({ name: x.name, role: x.role as Role })));
}

export async function upsertMessages(ms: Msg[]) {
  const d = await getDb();
  for (const m of ms) {
    await d.execute(
      `INSERT OR REPLACE INTO mail_messages (account_id,folder,uid,from_name,from_addr,to_addrs,subject,preview,date_ts,seen,starred,answered,has_attach)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [m.accountId, m.folder, m.uid, m.fromName, m.fromAddr, m.to, m.subject, m.preview, m.dateTs, +m.seen, +m.starred, +m.answered, +m.hasAttach]
    );
  }
}
export async function cachedMessages(accountId: string, folder: string): Promise<Msg[]> {
  const d = await getDb();
  const r = await d.select<MRow[]>("SELECT * FROM mail_messages WHERE account_id=$1 AND folder=$2 ORDER BY date_ts DESC, uid DESC LIMIT 2000", [accountId, folder]);
  return r.map(toMsg);
}
export async function cachedUids(accountId: string, folder: string): Promise<number[]> {
  const d = await getDb();
  return (await d.select<{ uid: number }[]>("SELECT uid FROM mail_messages WHERE account_id=$1 AND folder=$2", [accountId, folder])).map((x) => x.uid);
}
export async function dropMessages(accountId: string, folder: string, uids: number[]) {
  const d = await getDb();
  for (const u of uids) for (const t of ["mail_messages", "mail_bodies", "mail_meta", "mail_snooze"])
    await d.execute(`DELETE FROM ${t} WHERE account_id=$1 AND folder=$2 AND uid=$3`, [accountId, folder, u]);
}
export async function setCachedFlag(accountId: string, folder: string, uid: number, col: "seen" | "starred", on: boolean) {
  const d = await getDb();
  await d.execute(`UPDATE mail_messages SET ${col}=$1 WHERE account_id=$2 AND folder=$3 AND uid=$4`, [+on, accountId, folder, uid]);
}

export async function saveBody(accountId: string, folder: string, uid: number, b: Body) {
  const d = await getDb();
  await d.execute("INSERT OR REPLACE INTO mail_bodies (account_id,folder,uid,json) VALUES ($1,$2,$3,$4)", [accountId, folder, uid, JSON.stringify(b)]);
}
export async function cachedBody(accountId: string, folder: string, uid: number): Promise<Body | null> {
  const d = await getDb();
  const r = await d.select<{ json: string }[]>("SELECT json FROM mail_bodies WHERE account_id=$1 AND folder=$2 AND uid=$3", [accountId, folder, uid]);
  try { return r[0] ? (JSON.parse(r[0].json) as Body) : null; } catch { return null; }
}

/** Cached INBOX messages of every account (unified inbox). */
export async function cachedUnified(): Promise<Msg[]> {
  const r = await (await getDb()).select<MRow[]>(`SELECT m.* FROM mail_messages m JOIN mail_folders f ON f.account_id=m.account_id AND f.name=m.folder
    WHERE f.role='inbox' ORDER BY m.date_ts DESC LIMIT 2000`);
  return r.map(toMsg);
}
/** Messages with a snooze row (any folder, any account). */
export async function cachedSnoozed(): Promise<Msg[]> {
  const r = await (await getDb()).select<MRow[]>(`SELECT m.* FROM mail_messages m JOIN mail_snooze s ON s.account_id=m.account_id AND s.folder=m.folder AND s.uid=m.uid ORDER BY s.until_ts`);
  return r.map(toMsg);
}

/** Planet badge: unread messages in cached INBOXes (a count only). */
export async function unreadInbox(): Promise<number> {
  const d = await getDb();
  const r = await d.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM mail_messages WHERE folder = 'INBOX' AND seen = 0");
  return Number(r[0]?.n ?? 0);
}
