// SQLite side of "my representatives" (app_settings `congress_my_seat`, congress_rep_votes) and the
// followed-bill snapshots behind "what changed" (congress_bill_snap). Migration 39.
import { getDb } from "../../core/db";
import type { Bill } from "./parse";
import { billDiff, parseSeat, snapOf, type RepVote, type Seat, type Snap } from "./reps";

const KEY = "congress_my_seat";

export async function getSeat(): Promise<Seat | null> {
  const r = await (await getDb()).select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [KEY]);
  return r[0] ? parseSeat(r[0].value) : null;
}

export async function setSeat(args?: Record<string, unknown>) {
  const raw = String(args?.seat ?? "").trim();
  const d = await getDb();
  if (!raw) {
    await d.execute("DELETE FROM app_settings WHERE key = $1", [KEY]);
    return { ok: true };
  }
  if (!parseSeat(raw)) throw new Error('enter a state code and optional district, e.g. "CA 12"');
  await d.execute("INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2", [KEY, raw]);
  return { ok: true };
}

export async function saveRepVotes(memberId: string, votes: RepVote[]): Promise<void> {
  const d = await getDb();
  for (const v of votes)
    await d.execute("INSERT OR REPLACE INTO congress_rep_votes (member_id, vote_id, position, question, voted_at, link) VALUES ($1,$2,$3,$4,$5,$6)",
      [memberId, v.voteId, v.position, v.question, v.votedAt, v.link]);
}

export async function listRepVotes(): Promise<{ member_id: string; vote_id: string; position: string; question: string; voted_at: string | null; link: string | null }[]> {
  return (await getDb()).select("SELECT * FROM congress_rep_votes ORDER BY voted_at DESC LIMIT 300");
}

/** For followed bills: when the new snapshot differs, the old one becomes `prev`. */
export async function snapFollowed(bills: Bill[], followed: string[]): Promise<void> {
  const d = await getDb();
  const want = new Set(followed);
  for (const b of bills.filter((x) => want.has(x.id))) {
    const cur = JSON.stringify(snapOf(b));
    const old = (await d.select<{ cur: string }[]>("SELECT cur FROM congress_bill_snap WHERE id = $1", [b.id]))[0];
    if (!old) await d.execute("INSERT INTO congress_bill_snap (id, prev, cur) VALUES ($1, '{}', $2)", [b.id, cur]);
    else if (old.cur !== cur) await d.execute("UPDATE congress_bill_snap SET prev = cur, cur = $2 WHERE id = $1", [b.id, cur]);
  }
}

export async function loadDiffs(): Promise<Map<string, ReturnType<typeof billDiff>>> {
  const rows = await (await getDb()).select<{ id: string; prev: string; cur: string }[]>("SELECT * FROM congress_bill_snap");
  const parse = (s: string) => { try { return JSON.parse(s) as Snap; } catch { return null; } };
  return new Map(rows.map((r) => [r.id, billDiff(parse(r.prev), parse(r.cur) ?? ({} as Snap))]));
}
