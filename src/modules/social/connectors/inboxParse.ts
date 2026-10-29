// Pure mappers for the unified inbox (mentions/replies) — tested.
import type { SocialPost } from "./types.ts";
import { parseMastodon } from "./parse.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Mastodon /api/v1/notifications (types mention): each carries the status. */
export function parseMastoMentions(data: any[]): SocialPost[] {
  return parseMastodon((Array.isArray(data) ? data : []).filter((n) => n?.status && (n.type === "mention" || !n.type)).map((n) => n.status));
}

/** Bluesky app.bsky.notification.listNotifications: reasons mention / reply / quote only. */
export function parseBskyNotifications(data: any): SocialPost[] {
  return ((data?.notifications ?? []) as any[])
    .filter((n) => ["mention", "reply", "quote"].includes(n?.reason) && n?.author && n?.uri)
    .map((n): SocialPost => ({
      postId: n.uri,
      name: n.author.displayName || n.author.handle,
      handle: n.author.handle,
      avatar: typeof n.author.avatar === "string" && n.author.avatar.startsWith("https://") ? n.author.avatar : null,
      text: n.record?.text ?? "",
      link: `https://bsky.app/profile/${n.author.handle}/post/${String(n.uri).split("/").pop()}`,
      postedAt: n.record?.createdAt ?? n.indexedAt ?? null,
      media: [], likes: null, reposts: null, replies: null,
      meta: { cid: n.cid, rootUri: n.record?.reply?.root?.uri ?? n.uri, rootCid: n.record?.reply?.root?.cid ?? n.cid },
    }));
}
