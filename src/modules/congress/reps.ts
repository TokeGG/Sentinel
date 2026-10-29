// Pure: "my representatives" (state + district -> members), their recent votes (GovTrack vote_voter),
// and the "what changed" diff for followed bills.
import type { Bill } from "./parse.ts";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

export type Seat = { state: string; district: number | null };

/** "CA 12", "ca-12", "VT", "VT at-large" -> seat; null when the state is not two letters. */
export function parseSeat(s: string): Seat | null {
  const m = /^\s*([a-z]{2})(?:[\s-]*(\d{1,2}|at-?large|al))?\s*$/i.exec(s);
  if (!m) return null;
  const d = m[2] && /^\d+$/.test(m[2]) ? Number(m[2]) : m[2] ? 0 : null;
  return { state: m[1].toUpperCase(), district: d };
}

export const seatText = (s: Seat) => `${s.state}${s.district === null ? "" : s.district === 0 ? " at-large" : `-${s.district}`}`;

/** Senators of the state plus the House member for the district (any district when none given). */
export function myReps<T extends { state: string; chamber: string; district: number | null }>(members: T[], seat: Seat): T[] {
  return members.filter((m) => m.state === seat.state && (m.chamber === "senate" || (m.chamber === "house" && (seat.district === null || m.district === seat.district))));
}

export type RepVote = { voteId: string; position: string; question: string; votedAt: string | null; link: string | null };

/** GovTrack `vote_voter?person=` objects; `vote` may be an expanded object or a bare id (field names unverified live). */
export function parseVoterVotes(json: unknown): RepVote[] {
  const objs = Array.isArray(obj(json)?.objects) ? (obj(json)!.objects as unknown[]) : [];
  return objs.flatMap((x) => {
    const o = obj(x);
    if (!o) return [];
    const v = obj(o.vote);
    const voteId = str(v?.id ?? o.vote);
    if (!voteId) return [];
    const opt = obj(o.option);
    const link = str(v?.link);
    return [{
      voteId, position: str(opt?.value ?? o.option) || "?", question: str(v?.question) || `Vote ${voteId}`,
      votedAt: str(v?.created ?? o.created).slice(0, 10) || null, link: /^https:\/\//.test(link) ? link : null,
    }];
  });
}

export type Snap = { title: string; status: string; date: string; sponsor: string; actions: number; last: string };
export const snapOf = (b: Pick<Bill, "title" | "statusLabel" | "statusDate" | "sponsor" | "history">): Snap => ({
  title: b.title, status: b.statusLabel, date: b.statusDate ?? "", sponsor: b.sponsor ?? "", actions: b.history.length, last: b.history[b.history.length - 1]?.text ?? "",
});

const LABEL: Record<keyof Snap, string> = { title: "Title", status: "Status", date: "Status date", sponsor: "Sponsor", actions: "Actions", last: "Latest action" };

/** Field-level changes between two snapshots (empty when no earlier snapshot). */
export function billDiff(prev: Partial<Snap> | null, cur: Snap): { field: string; from: string; to: string }[] {
  if (!prev || !Object.keys(prev).length) return [];
  return (Object.keys(LABEL) as (keyof Snap)[])
    .filter((k) => prev[k] !== undefined && String(prev[k]) !== String(cur[k]))
    .map((k) => ({ field: LABEL[k], from: String(prev[k]), to: String(cur[k]) }));
}
