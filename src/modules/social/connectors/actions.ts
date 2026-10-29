// Pure request builders / response parsers for per-post actions (no Tauri, no
// network) — tested in actions.test.ts. Connectors do only the fetch.
import type { PostMeta, PostRef } from "./types.ts";

const need = (v: string | undefined, what: string): string => {
  if (!v) throw new Error(`${what} unknown for this post — press Refresh first`);
  return v;
};

// ---- Bluesky (com.atproto.repo.createRecord / deleteRecord) ----
const create = (did: string, collection: string, record: object, now: string): { repo: string; collection: string; record: Record<string, unknown> } =>
  ({ repo: did, collection, record: { $type: collection, createdAt: now, ...record } });
const subject = (p: PostRef) => ({ uri: p.postId, cid: need(p.meta.cid, "Post id") });

export const bskyLike = (did: string, p: PostRef, now = new Date().toISOString()) =>
  create(did, "app.bsky.feed.like", { subject: subject(p) }, now);
export const bskyRepost = (did: string, p: PostRef, now = new Date().toISOString()) =>
  create(did, "app.bsky.feed.repost", { subject: subject(p) }, now);
export function bskyReply(did: string, p: PostRef, text: string, now = new Date().toISOString()) {
  const parent = subject(p);
  const root = p.meta.rootUri && p.meta.rootCid ? { uri: p.meta.rootUri, cid: p.meta.rootCid } : parent;
  return create(did, "app.bsky.feed.post", { text, reply: { root, parent } }, now);
}
/** at://did/collection/rkey -> deleteRecord body. */
export function bskyDelete(did: string, recordUri: string | undefined) {
  const m = /^at:\/\/[^/]+\/([^/]+)\/([^/]+)$/.exec(need(recordUri, "Record"));
  if (!m) throw new Error("bad record uri");
  return { repo: did, collection: m[1], rkey: m[2] };
}
export const bskyCreatedUri = (json: unknown): string => {
  const u = (json as { uri?: unknown } | null)?.uri;
  if (typeof u !== "string" || !u) throw new Error("Bluesky returned no record uri");
  return u;
};

// ---- Mastodon ----
export type MastoAction = "favourite" | "unfavourite" | "reblog" | "unreblog";
export const mastoUrl = (base: string, p: PostRef, a: MastoAction) =>
  `${base.replace(/\/+$/, "")}/api/v1/statuses/${encodeURIComponent(p.meta.targetId ?? p.postId)}/${a}`;
export const mastoReplyBody = (p: PostRef, text: string) => ({ status: text, in_reply_to_id: p.meta.targetId ?? p.postId });
/** Meta changes a successful Mastodon response implies. */
export const mastoPatch = (a: MastoAction): PostMeta =>
  a === "favourite" ? { liked: true } : a === "unfavourite" ? { liked: false } : a === "reblog" ? { shared: true } : { shared: false };

// ---- Reddit ----
const thing = (p: PostRef) => (p.postId.startsWith("t3_") ? p.postId : `t3_${p.postId}`);
/** dir 1 = upvote, 0 = clear the vote. */
export const redditVoteBody = (p: PostRef, dir: 1 | 0) => new URLSearchParams({ id: thing(p), dir: String(dir) }).toString();
export const redditCommentBody = (p: PostRef, text: string) =>
  new URLSearchParams({ api_type: "json", thing_id: thing(p), text }).toString();
/** Reddit answers 200 with errors in the body; returns the first message or null. */
export function redditCommentError(json: unknown): string | null {
  const errs = (json as { json?: { errors?: unknown[][] } } | null)?.json?.errors;
  return Array.isArray(errs) && errs.length ? String(errs[0][1] ?? errs[0][0]) : null;
}
