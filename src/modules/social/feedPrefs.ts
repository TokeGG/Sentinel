// Pure Social feed preferences: length filter, hide reposts, quiet hours, "save to Notes" body.
import type { FeedPost } from "./panelLogic.ts";

/** True when `hour` (0-23) is inside quiet hours [from, to); wraps past midnight (22 -> 7). from == to = never. */
export function inQuiet(hour: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

export interface LenPrefs { minLen: number; maxLen: number; hideReposts: boolean }

/** Drops posts shorter than minLen / longer than maxLen characters (0 = no limit) and, if asked, reposts/boosts. */
export function applyFeedPrefs<T extends Pick<FeedPost, "text" | "meta">>(posts: T[], p: LenPrefs): T[] {
  return posts.filter((x) => {
    const n = x.text.trim().length;
    if (p.minLen > 0 && n < p.minLen) return false;
    if (p.maxLen > 0 && n > p.maxLen) return false;
    return !(p.hideReposts && x.meta?.repost);
  });
}

/** Note text for the Notes capture_note skill. */
export function noteBody(p: Pick<FeedPost, "name" | "handle" | "text" | "link" | "platform">): string {
  return [`${p.name} (@${p.handle.replace(/^@/, "")}, ${p.platform}):`, p.text.trim(), p.link ?? ""].filter(Boolean).join("\n");
}
