// Pure helpers for per-post actions (optimistic UI), no React/Tauri.
import type { FeedPost } from "./panelLogic.ts";

export type ActionKind = "like" | "unlike" | "share" | "unshare";
export const postKey = (p: { platform: string; postId: string }) => `${p.platform}\u0000${p.postId}`;

const bump = (n: number | null, d: number) => (n === null ? null : Math.max(0, n + d));

/** Optimistic result of an action: flag flipped, count adjusted (null counts stay null). */
export function applyAction(p: FeedPost, kind: ActionKind): FeedPost {
  const on = kind === "like" || kind === "share";
  const d = on ? 1 : -1;
  return kind === "like" || kind === "unlike"
    ? { ...p, likes: bump(p.likes, d), meta: { ...p.meta, liked: on } }
    : { ...p, reposts: bump(p.reposts, d), meta: { ...p.meta, shared: on } };
}

/** A successful reply: one more reply. */
export const withReply = (p: FeedPost): FeedPost => ({ ...p, replies: bump(p.replies, 1) });

/** Which action buttons a card shows: needs the setting and a connected account that supports it. */
export function cardActions(s: { connected: boolean; can: { like: boolean; share: boolean; reply: boolean } } | undefined, show: boolean) {
  const on = show && !!s?.connected;
  return { like: on && s!.can.like, share: on && s!.can.share, reply: on && s!.can.reply };
}
