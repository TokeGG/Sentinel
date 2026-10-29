// Pure: mute words/accounts and follow lists (groups of handles) as feed filters.
import type { FeedPost } from "./panelLogic.ts";

export interface Mutes { words: string[]; accounts: Set<string> }
export const normHandle = (h: string) => h.trim().replace(/^@/, "").toLowerCase();
export const acctKey = (platform: string, handle: string) => `${platform}:${normHandle(handle)}`;

export function toMutes(rows: { kind: string; value: string }[]): Mutes {
  return { words: rows.filter((r) => r.kind === "word").map((r) => r.value.toLowerCase()), accounts: new Set(rows.filter((r) => r.kind === "account").map((r) => r.value.toLowerCase())) };
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Drops posts by a muted account (platform:handle, or bare handle for any platform) or containing a muted word. */
export function applyMutes(posts: FeedPost[], m: Mutes): FeedPost[] {
  const res = m.words.filter(Boolean).map((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(w)}($|[^\\p{L}\\p{N}])`, "iu"));
  return posts.filter((p) => !m.accounts.has(acctKey(p.platform, p.handle)) && !m.accounts.has(normHandle(p.handle)) && !res.some((r) => r.test(p.text)));
}

/** list name -> member keys ("platform:handle"). */
export function toLists(rows: { name: string; platform: string; handle: string }[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const r of rows) { if (!out.has(r.name)) out.set(r.name, new Set()); out.get(r.name)!.add(acctKey(r.platform, r.handle)); }
  return out;
}
export const inList = (posts: FeedPost[], members: Set<string> | undefined) => (members ? posts.filter((p) => members.has(acctKey(p.platform, p.handle))) : posts);
