/** Per-post ids/state the actions need (persisted in social_post_meta). */
export interface PostMeta {
  cid?: string; // Bluesky: content id of the post
  rootUri?: string; // Bluesky: thread root (for replies)
  rootCid?: string;
  targetId?: string; // Mastodon: id of the status to act on (the original of a boost)
  liked?: boolean;
  likeUri?: string; // Bluesky: the like record, deleted to un-like
  shared?: boolean; // boosted / reposted
  shareUri?: string; // Bluesky: the repost record
  repost?: boolean; // this feed entry is someone's repost/boost of another post
}

export interface PostRef {
  postId: string;
  meta: PostMeta;
}

export interface SocialPost {
  postId: string;
  name: string; // display name
  handle: string;
  avatar: string | null;
  text: string;
  link: string | null;
  postedAt: string | null; // ISO
  media: string[]; // image thumbnail URLs
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  meta?: PostMeta;
}

export interface CredentialSpec {
  key: string;
  label: string;
}

export interface SocialConnector {
  id: string;
  label: string;
  // "oauth": a `connect()` skill does a real sign-in (browser + loopback
  // redirect) — no password ever touches this app. "manual": the platform
  // has no usable public-client OAuth, so a couple of credential fields are
  // the only option.
  authType: "oauth" | "manual";
  credentials: CredentialSpec[]; // manual: entered by hand; oauth: pre-reqs only (e.g. instance URL)
  connect?: () => Promise<void>; // oauth connectors only
  /** The credential key whose presence means "connected". */
  connectedKey: string | null;
  /** Overrides the connectedKey check (connectors bridged to core/connect). */
  isConnected?: () => Promise<boolean>;
  fetchFeed(): Promise<SocialPost[]>;
  /** Present only where the connector can publish; the rest are read-only. */
  post?(text: string): Promise<void>;
  // Per-post actions; absent = the button is hidden. Each resolves to the
  // meta fields it changed (e.g. the new like record uri).
  like?(p: PostRef): Promise<PostMeta>;
  unlike?(p: PostRef): Promise<PostMeta>;
  share?(p: PostRef): Promise<PostMeta>;
  unshare?(p: PostRef): Promise<PostMeta>;
  reply?(p: PostRef, text: string): Promise<void>;
  /** Mentions/replies to you (unified inbox); absent = the API gives none we can read. */
  fetchInbox?(): Promise<SocialPost[]>;
}
