// Pure helpers for the Congress panel: sections, row typing, search/filter, follow updates.
import type { Bill, Member, Vote } from "./parse.ts";

type Row = Record<string, unknown>;

export const congressSections = [
  { id: "sync", label: "Sync & auto-refresh" },
  { id: "search", label: "Search & filters" },
  { id: "bills", label: "Bills" },
  { id: "votes", label: "Roll-call votes" },
  { id: "members", label: "Members" },
  { id: "mine", label: "My representatives" },
];

/** Ids to honour. Outside a saved view (the News > Congress tab) useSections() is [] = show everything;
 * treating [] as "nothing visible" hid every list, so Congress looked empty even after a sync. */
export const visibleSections = (ids: string[]): string[] => (ids.length ? ids : congressSections.map((s) => s.id));

export type Tab = "bills" | "votes" | "members" | "mine";
export const TABS: { id: Tab; label: string }[] = [
  { id: "bills", label: "Bills" },
  { id: "votes", label: "Votes" },
  { id: "members", label: "Members" },
  { id: "mine", label: "My reps" },
];

/** The tab to show: `chosen` if its section is visible, else the first visible one (null if none). */
export function shownTab(ids: string[], chosen: Tab): Tab | null {
  const vis = TABS.filter((t) => ids.includes(t.id));
  return vis.some((t) => t.id === chosen) ? chosen : (vis[0]?.id ?? null);
}

/** A load() row: the parsed record plus `ref` (its database id; `id` is the prefixed row key). */
type Ref<T> = T & { ref: string };
export type BillRow = Ref<Bill> & { followed: boolean; unseen: boolean; changes?: { field: string; from: string; to: string }[] };
export type VoteRow = Ref<Vote>;
export type MemberRow = Ref<Member> & { followed: boolean };

/** Splits load() rows by their `kind`; unknown kinds are ignored. */
export function splitRows(rows: Row[]) {
  const of = <T,>(k: string) => rows.filter((r) => r.kind === k) as unknown as T[];
  return { bills: of<BillRow>("bill"), votes: of<VoteRow>("vote"), members: of<MemberRow>("member") };
}

/** Case-insensitive AND match of every query word against the joined fields. */
export function matchesQuery(fields: (string | null | undefined)[], query: string): boolean {
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export const filterBills = (b: BillRow[], q: string, followedOnly: boolean) =>
  b.filter((x) => (!followedOnly || x.followed) && matchesQuery([x.number, x.title, x.sponsor, x.statusLabel], q));
export const filterVotes = (v: VoteRow[], q: string, chamber: string) =>
  v.filter((x) => (!chamber || x.chamber === chamber) && matchesQuery([x.question, x.bill, x.result, x.chamber], q));
export const filterMembers = (m: MemberRow[], q: string, followedOnly: boolean, party: string) =>
  m
    .filter((x) => (!followedOnly || x.followed) && (!party || x.party === party) && matchesQuery([x.name, x.state, x.party, x.chamber], q))
    .sort((a, b) => Number(b.followed) - Number(a.followed) || a.name.localeCompare(b.name));

/** "230 yes · 200 no · 5 other"; "" when no totals are known. */
export function tallyText(v: Pick<Vote, "yes" | "no" | "other">): string {
  const p = [v.yes !== null && `${v.yes} yes`, v.no !== null && `${v.no} no`, v.other ? `${v.other} other` : false].filter(Boolean);
  return p.join(" · ");
}

/** "Rep. · CA-12", "Sen. · VT" */
export function seat(m: Pick<Member, "chamber" | "state" | "district">): string {
  const where = m.chamber === "house" && m.district ? `${m.state}-${m.district}` : m.state;
  return [m.chamber === "senate" ? "Senate" : m.chamber === "house" ? "House" : "", where].filter(Boolean).join(" · ");
}

export interface FollowRow { ref: string; label: string; last_status: string }

/** Followed bills whose status differs from the last seen one (first sight, last_status "", is not a change). */
export function followUpdates(follows: FollowRow[], bills: Pick<Bill, "id" | "status">[]): { ref: string; status: string }[] {
  const now = new Map(bills.map((b) => [b.id, b.status]));
  return follows.flatMap((f) => {
    const s = now.get(f.ref);
    return s !== undefined && s !== f.last_status && f.last_status !== "" ? [{ ref: f.ref, status: s }] : [];
  });
}
