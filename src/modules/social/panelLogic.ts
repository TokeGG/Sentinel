// Pure helpers for the Social feed panel (no React/Tauri).
import type { OptionDef } from "../../core/customizeChecks.ts";
import { ago } from "../../ui/kit/format.ts";
import { safeLink } from "../../ui/safeLink.ts";
import type { PostMeta } from "./connectors/types.ts";

export interface FeedPost {
  platform: string;
  postId: string;
  name: string;
  handle: string;
  avatar: string | null;
  text: string;
  link: string | null;
  media: string[];
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  postedAt: string | null;
  meta: PostMeta;
}

export const KEEP_PER_PLATFORM = 500;

export const socialSections = [
  { id: "composer", label: "Composer" },
  { id: "filters", label: "Filters & search" },
  { id: "feed", label: "Feed" },
  { id: "lists", label: "Lists & mutes", default: false },
  { id: "accounts", label: "Accounts" },
];

export const socialOptions: OptionDef[] = [
  { key: "density", label: "Density", type: "select", choices: ["comfortable", "compact"], default: "comfortable" },
  { key: "showMedia", label: "Show media", type: "toggle", default: true },
  { key: "showCounts", label: "Show counts", type: "toggle", default: true },
  { key: "showActions", label: "Show actions (like, boost, reply)", type: "toggle", default: true },
  { key: "taste", label: "For you ordering", type: "toggle", default: true },
  { key: "minLen", label: "Hide posts shorter than (characters, 0 = off)", type: "number", default: 0, min: 0, max: 1000 },
  { key: "maxLen", label: "Hide posts longer than (characters, 0 = off)", type: "number", default: 0, min: 0, max: 10000 },
  { key: "hideReposts", label: "Hide reposts / boosts", type: "toggle", default: false },
  { key: "quietOn", label: "Quiet hours (hide the feed)", type: "toggle", default: false },
  { key: "quietFrom", label: "Quiet from (hour, 0-23)", type: "number", default: 22, min: 0, max: 23 },
  { key: "quietTo", label: "Quiet until (hour, 0-23)", type: "number", default: 7, min: 0, max: 23 },
];

export const PLATFORM_COLORS: Record<string, string> = {
  bluesky: "#1185fe",
  mastodon: "#6364ff",
  reddit: "#ff4500",
  x: "#8899a6",
};
export const platformColor = (id: string) => PLATFORM_COLORS[id] ?? "#8899a6";

/** Stable 0-359 hue for an initial avatar. */
export const nameHue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** Max post length per platform (Mastodon's is the common default; instances vary). */
export const POST_LIMITS: Record<string, number> = { bluesky: 300, mastodon: 500 };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const time = (p: FeedPost) => (p.postedAt ? Date.parse(p.postedAt) : NaN);

/** A social_feed DB row -> FeedPost (bad media JSON -> no media). */
export function rowToPost(r: Record<string, unknown>): FeedPost {
  let media: string[] = [];
  try {
    const m: unknown = JSON.parse(String(r.media ?? "[]"));
    if (Array.isArray(m)) media = m.filter((u): u is string => typeof u === "string");
  } catch { /* keep [] */ }
  let meta: PostMeta = {};
  try {
    const m: unknown = JSON.parse(String(r.meta ?? "{}"));
    if (m && typeof m === "object" && !Array.isArray(m)) meta = m as PostMeta;
  } catch { /* keep {} */ }
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    platform: String(r.platform), postId: String(r.post_id), name: String(r.name ?? ""), handle: String(r.handle ?? ""),
    avatar: s(r.avatar), text: String(r.text ?? ""), link: s(r.link), media,
    likes: num(r.likes), reposts: num(r.reposts), replies: num(r.replies), postedAt: s(r.posted_at), meta,
  };
}

/** Merge lists, dedupe by (platform, id) keeping the last seen, newest first (undated last). */
export function mergePosts(...lists: FeedPost[][]): FeedPost[] {
  const byKey = new Map<string, FeedPost>();
  for (const p of lists.flat()) byKey.set(`${p.platform}\u0000${p.postId}`, p);
  return [...byKey.values()].sort((a, b) => {
    const [x, y] = [time(a), time(b)];
    if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) === Number.isNaN(y) ? 0 : Number.isNaN(x) ? 1 : -1;
    return y - x;
  });
}

/** Platform chips (empty = all) and a case-insensitive search over name, handle and text. */
export function filterPosts(posts: FeedPost[], platforms: string[], query: string): FeedPost[] {
  const q = query.trim().toLowerCase();
  return posts.filter(
    (p) =>
      (platforms.length === 0 || platforms.includes(p.platform)) &&
      (!q || `${p.name} ${p.handle} ${p.text}`.toLowerCase().includes(q))
  );
}

/** Posts newer than the last visit (0 when there was no earlier visit). */
export function unreadCount(posts: FeedPost[], lastVisit: string | null): number {
  const lv = lastVisit ? Date.parse(lastVisit) : NaN;
  return Number.isNaN(lv) ? 0 : posts.filter((p) => time(p) > lv).length;
}

/** Index of the post the "new since last visit" divider goes before; -1 for none. */
export function dividerIndex(posts: FeedPost[], lastVisit: string | null): number {
  const n = unreadCount(posts, lastVisit);
  return n > 0 && n < posts.length ? n : -1;
}

/** "5m", "3h", "2d"; older than a week -> "Oct 3"; "" for no/invalid date. */
export function postAge(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  if (now.getTime() - t < 7 * 86400_000) return ago(iso, now);
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export type Segment = { text: string; url?: string };
/** Split text into plain and http(s) link segments (trailing punctuation stays text). */
export function linkify(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, "");
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(safeLink(url) ? { text: url, url } : { text: url });
    last = m.index + url.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Why the composer can't post right now, or null. */
export function composeError(text: string, targets: string[]): string | null {
  if (targets.length === 0) return "Pick an account to post to";
  if (!text.trim()) return "Write something first";
  const over = targets.find((t) => POST_LIMITS[t] && text.length > POST_LIMITS[t]);
  return over ? `Too long for ${over} (max ${POST_LIMITS[over]})` : null;
}
