// Pure CS2 helpers: manual match reminders (sanitize, order, live state from the entered time only)
// and picking HLTV headlines out of News rows already fetched.
import { isLiveWindow } from "../media/plan.ts";

export interface Match { id: string; teams: string; event: string; start: number }
export const isMatch = (x: unknown): x is Match => {
  const m = x as Match;
  return !!m && typeof m.id === "string" && typeof m.teams === "string" && typeof m.event === "string" && Number.isFinite(m.start);
};

/** Live first, then upcoming soonest first; finished (past start + hours) dropped unless `keepPast`. */
export function matchList(ms: Match[], hours: number, now: number, keepPast = false): (Match & { live: boolean })[] {
  return ms
    .map((m) => ({ ...m, live: isLiveWindow(m.start, hours, now) }))
    .filter((m) => keepPast || m.live || m.start > now)
    .sort((a, b) => Number(b.live) - Number(a.live) || a.start - b.start);
}

export const liveCount = (ms: Match[], hours: number, now: number) => ms.filter((m) => isLiveWindow(m.start, hours, now)).length;

/** HLTV items among already-fetched News rows (link or feed url on hltv.org). */
export function hltvRows<T extends { link?: unknown; source_url?: unknown }>(rows: T[], n = 10): T[] {
  return rows.filter((r) => /^https:\/\/(www\.)?hltv\.org\//i.test(String(r.link ?? "")) || /hltv\.org/i.test(String(r.source_url ?? ""))).slice(0, n);
}
