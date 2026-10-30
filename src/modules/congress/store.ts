// SQLite side of the Congress module (tables from migration 31). Thin; the decisions live in parse.ts / panelLogic.ts.
import { getDb } from "../../core/db";
import type { Bill, Member, Vote } from "./parse";
import { followUpdates, type FollowRow } from "./panelLogic";
import { loadDiffs } from "./repStore";

export async function saveBills(bills: Bill[]): Promise<void> {
  const d = await getDb();
  for (const b of bills)
    await d.execute(
      `INSERT OR REPLACE INTO congress_bills (id, congress, number, title, status, status_label, status_date, introduced, sponsor, link, history)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [b.id, b.congress, b.number, b.title, b.status, b.statusLabel, b.statusDate, b.introduced, b.sponsor, b.link, JSON.stringify(b.history)]
    );
}

export async function saveVotes(votes: Vote[]): Promise<void> {
  const d = await getDb();
  for (const v of votes)
    await d.execute(
      `INSERT OR REPLACE INTO congress_votes (id, chamber, question, result, voted_at, yes, no, other, bill, link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [v.id, v.chamber, v.question, v.result, v.votedAt, v.yes, v.no, v.other, v.bill, v.link]
    );
}

export async function saveMembers(members: Member[]): Promise<void> {
  const d = await getDb();
  for (const m of members)
    await d.execute(
      `INSERT OR REPLACE INTO congress_members (id, name, party, state, chamber, district, title, link) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [m.id, m.name, m.party, m.state, m.chamber, m.district, m.title, m.link]
    );
}

/** Ids of followed bills (to re-fetch even when they fall out of the recent list). */
export async function followedBillIds(): Promise<string[]> {
  const d = await getDb();
  return (await d.select<{ ref: string }[]>("SELECT ref FROM congress_follows WHERE kind = 'bill'")).map((r) => r.ref);
}

/** Marks followed bills whose stored status changed since last seen as unseen; returns how many. */
export async function flagBillUpdates(): Promise<number> {
  const d = await getDb();
  const follows = await d.select<FollowRow[]>("SELECT ref, label, last_status FROM congress_follows WHERE kind = 'bill'");
  const bills = await d.select<{ id: string; status: string }[]>("SELECT id, status FROM congress_bills");
  const changed = followUpdates(follows, bills);
  for (const c of changed) await d.execute("UPDATE congress_follows SET last_status = $1, unseen = 1 WHERE kind = 'bill' AND ref = $2", [c.status, c.ref]);
  // First sight after following (last_status empty): record the baseline silently.
  await d.execute(
    "UPDATE congress_follows SET last_status = COALESCE((SELECT status FROM congress_bills b WHERE b.id = ref), '') WHERE kind = 'bill' AND last_status = ''"
  );
  return changed.length;
}

export async function follow(kind: string, ref: string, label: string): Promise<void> {
  const d = await getDb();
  await d.execute(
    `INSERT OR IGNORE INTO congress_follows (kind, ref, label, last_status)
     VALUES ($1, $2, $3, COALESCE((SELECT status FROM congress_bills WHERE id = $2 AND $1 = 'bill'), ''))`,
    [kind, ref, label]
  );
}

export async function unfollow(kind: string, ref: string): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM congress_follows WHERE kind = $1 AND ref = $2", [kind, ref]);
}

export async function markSeen(ref: string | null): Promise<void> {
  const d = await getDb();
  await d.execute(`UPDATE congress_follows SET unseen = 0 WHERE kind = 'bill'${ref ? " AND ref = $1" : ""}`, ref ? [ref] : []);
}

/** Deletes cached bills/votes/members; follows are kept (and re-attach on the next sync). */
export async function clearCache(): Promise<void> {
  const d = await getDb();
  for (const t of ["congress_bills", "congress_votes", "congress_members", "congress_rep_votes"]) await d.execute(`DELETE FROM ${t}`);
}

export async function unseenCount(): Promise<number> {
  const d = await getDb();
  const r = await d.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM congress_follows WHERE kind = 'bill' AND unseen = 1");
  return Number(r[0]?.n ?? 0);
}

type Raw = Record<string, unknown>;

export async function loadRows(): Promise<Raw[]> {
  const d = await getDb();
  const bills = await d.select<Raw[]>(
    `SELECT b.*, f.ref IS NOT NULL AS followed, COALESCE(f.unseen, 0) AS unseen FROM congress_bills b
     LEFT JOIN congress_follows f ON f.kind = 'bill' AND f.ref = b.id
     ORDER BY followed DESC, b.status_date DESC LIMIT 150`
  );
  const votes = await d.select<Raw[]>("SELECT * FROM congress_votes ORDER BY voted_at DESC LIMIT 80");
  const members = await d.select<Raw[]>(
    `SELECT m.*, f.ref IS NOT NULL AS followed FROM congress_members m
     LEFT JOIN congress_follows f ON f.kind = 'member' AND f.ref = m.id ORDER BY m.name LIMIT 700`
  );
  const diffs = await loadDiffs().catch(() => new Map<string, { field: string; from: string; to: string }[]>());
  const hist = (s: unknown) => {
    try { return JSON.parse(String(s)); } catch { return []; }
  };
  return [
    ...bills.map((b) => ({
      kind: "bill", id: `bill-${b.id}`, title: `${b.number} ${b.title}`, label: b.status_label,
      ref: b.id, number: b.number, congress: b.congress, status: b.status, statusLabel: b.status_label, statusDate: b.status_date,
      introduced: b.introduced, sponsor: b.sponsor, link: b.link, history: hist(b.history), followed: !!b.followed, unseen: !!b.unseen, changes: diffs.get(String(b.id)) ?? [],
    })),
    ...votes.map((v) => ({
      kind: "vote", id: `vote-${v.id}`, title: String(v.question), label: v.result, ref: v.id, chamber: v.chamber, question: v.question,
      result: v.result, votedAt: v.voted_at, yes: v.yes, no: v.no, other: v.other, bill: v.bill, link: v.link,
    })),
    ...members.map((m) => ({
      kind: "member", id: `member-${m.id}`, title: String(m.name), ref: m.id, name: m.name, party: m.party, state: m.state,
      chamber: m.chamber, district: m.district, memberTitle: m.title, link: m.link, followed: !!m.followed,
    })),
  ];
}
