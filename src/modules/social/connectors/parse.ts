// Pure mappers from each platform's JSON to SocialPost (no Tauri) — tested.
import type { SocialPost } from "./types.ts";

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

/** Mastodon HTML -> plain text, keeping paragraph/line breaks. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m] ?? m)
    .trim();
}

const iso = (v: string | number | undefined): string | null => {
  if (v === undefined) return null;
  const d = new Date(typeof v === "number" ? v * 1000 : v); // numbers are epoch seconds
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const https = (v: unknown): string | null => (typeof v === "string" && /^https:\/\//i.test(v) ? v : null);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseBluesky(data: any): SocialPost[] {
  return (data?.feed ?? []).map(({ post, reason }: any): SocialPost => {
    const emb = post.embed?.images ? post.embed : post.embed?.media;
    return {
      postId: post.uri,
      name: post.author.displayName || post.author.handle,
      handle: post.author.handle,
      avatar: https(post.author.avatar),
      text: post.record?.text ?? "",
      link: `https://bsky.app/profile/${post.author.handle}/post/${String(post.uri).split("/").pop()}`,
      postedAt: iso(post.record?.createdAt),
      media: ((emb?.images ?? []) as any[]).map((i) => https(i.thumb)).filter((u): u is string => !!u),
      likes: n(post.likeCount),
      reposts: n(post.repostCount),
      replies: n(post.replyCount),
      meta: {
        cid: post.cid,
        rootUri: post.record?.reply?.root?.uri ?? post.uri,
        rootCid: post.record?.reply?.root?.cid ?? post.cid,
        liked: !!post.viewer?.like,
        likeUri: post.viewer?.like,
        shared: !!post.viewer?.repost,
        shareUri: post.viewer?.repost,
        ...(String(reason?.$type ?? "").includes("Repost") ? { repost: true } : {}),
      },
    };
  });
}

export function parseMastodon(data: any[]): SocialPost[] {
  return data.map((o): SocialPost => {
    const p = o.reblog ?? o; // a boost shows the original post
    return {
      postId: String(o.id),
      name: p.account.display_name || p.account.acct,
      handle: p.account.acct,
      avatar: https(p.account.avatar),
      text: htmlToText(p.content ?? ""),
      link: p.url ?? null,
      postedAt: iso(p.created_at),
      media: ((p.media_attachments ?? []) as any[])
        .filter((m) => m.type === "image")
        .map((m) => https(m.preview_url))
        .filter((u): u is string => !!u),
      likes: n(p.favourites_count),
      reposts: n(p.reblogs_count),
      replies: n(p.replies_count),
      meta: { targetId: String(p.id), liked: !!p.favourited, shared: !!p.reblogged, ...(o.reblog ? { repost: true } : {}) },
    };
  });
}

export function parseReddit(data: any): SocialPost[] {
  return (data?.data?.children ?? []).map(({ data: p }: any): SocialPost => ({
    postId: p.id,
    name: `r/${p.subreddit}`,
    handle: `u/${p.author}`,
    avatar: null,
    text: p.title,
    link: `https://reddit.com${p.permalink}`,
    postedAt: iso(p.created_utc),
    media: [https(p.thumbnail)].filter((u): u is string => !!u),
    likes: n(p.score),
    reposts: null,
    replies: n(p.num_comments),
    meta: { liked: p.likes === true },
  }));
}
