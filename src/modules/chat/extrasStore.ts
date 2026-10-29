// SQLite for chat extras (migration 38): user nick/colour, filters, local logs.
// Logs are written only when the user turned "Keep searchable logs" on (mentions
// and highlights go to the mention log either way); both are capped.
import { getDb } from "../../core/db";
import { overCap, type UserPref } from "./chatExtras.ts";

export async function loadPrefs(): Promise<{ users: Map<string, UserPref>; filters: { kind: string; value: string }[] }> {
  const d = await getDb();
  const [u, f] = await Promise.all([
    d.select<{ user_key: string; nick: string; color: string }[]>("SELECT * FROM chat_users"),
    d.select<{ kind: string; value: string }[]>("SELECT * FROM chat_filters ORDER BY kind, value"),
  ]);
  return { users: new Map(u.map((r) => [r.user_key, { nick: r.nick, color: r.color }])), filters: f };
}
export async function setUserPref(key: string, p: UserPref) {
  const d = await getDb();
  if (!p.nick && !p.color) await d.execute("DELETE FROM chat_users WHERE user_key=$1", [key]);
  else await d.execute("INSERT OR REPLACE INTO chat_users (user_key, nick, color) VALUES ($1,$2,$3)", [key, p.nick, p.color]);
}
export async function setFilter(kind: string, value: string, on: boolean) {
  const d = await getDb();
  if (on) await d.execute("INSERT OR IGNORE INTO chat_filters (kind, value) VALUES ($1,$2)", [kind, value]);
  else await d.execute("DELETE FROM chat_filters WHERE kind=$1 AND value=$2", [kind, value]);
}

export interface LogRow { id: number; room: string; user: string; text: string; ts: number; mention: number }
export async function writeLogs(rows: Omit<LogRow, "id">[], cap: number) {
  if (!rows.length) return;
  const d = await getDb();
  for (const r of rows) await d.execute("INSERT INTO chat_logs (room, user, text, ts, mention) VALUES ($1,$2,$3,$4,$5)", [r.room, r.user, r.text.slice(0, 600), r.ts, r.mention]);
  const n = Number((await d.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM chat_logs"))[0]?.n ?? 0);
  const drop = overCap(n, cap);
  if (drop) await d.execute("DELETE FROM chat_logs WHERE id IN (SELECT id FROM chat_logs ORDER BY id LIMIT $1)", [drop]);
}
export async function searchLogs(q: string, mentionsOnly: boolean): Promise<LogRow[]> {
  const like = `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return (await getDb()).select<LogRow[]>(
    `SELECT * FROM chat_logs WHERE ($1 = 0 OR mention = 1) AND (text LIKE $2 ESCAPE '\\' OR user LIKE $2 ESCAPE '\\' OR room LIKE $2 ESCAPE '\\') ORDER BY id DESC LIMIT 300`,
    [mentionsOnly ? 1 : 0, like]);
}
export async function clearLogs() { await (await getDb()).execute("DELETE FROM chat_logs"); }
