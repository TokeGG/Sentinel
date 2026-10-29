// Pure: "Following & Likes" per platform. Endpoint URLs, response parsers and an
// honest note per platform about what its API allows. No I/O.
export interface FollowItem { title: string; subtitle?: string; url: string | null }
export interface FollowLists { following: FollowItem[]; liked: FollowItem[] }
export type Can = "api" | "none";

export interface FollowPlatform {
  id: string; label: string; following: Can; liked: Can;
  /** What the owner must have connected, or why the API cannot do it. */
  note: string;
  /** For sites with no usable API: their own pages, opened in the browser. */
  pages?: { label: string; url: string }[];
}

export const FOLLOW_PLATFORMS: FollowPlatform[] = [
  { id: "twitch", label: "Twitch", following: "api", liked: "none", note: "Followed channels via Helix (Settings > Accounts > Twitch, user:read:follows). Twitch has no likes." },
  { id: "youtube", label: "YouTube", following: "api", liked: "api", note: "Subscriptions and liked videos (Settings > Accounts > YouTube (Google))." },
  { id: "reddit", label: "Reddit", following: "api", liked: "api", note: "Subscribed subreddits and upvoted posts (Settings > Accounts > Reddit; needs the mysubreddits + history permissions: older sign-ins must Connect again)." },
  { id: "mastodon", label: "Mastodon", following: "api", liked: "api", note: "Accounts you follow and your favourites (Settings > Accounts > Mastodon, no setup)." },
  { id: "bluesky", label: "Bluesky", following: "api", liked: "api", note: "Follows and likes (Social > Accounts: handle + app password)." },
  { id: "github", label: "GitHub", following: "api", liked: "api", note: "People you follow and starred repos (Settings > Accounts > GitHub, or the GitHub PAT)." },
  { id: "x", label: "X", following: "none", liked: "none", note: "X's free API tier cannot read follows or likes. Open the pages on X instead.",
    pages: [{ label: "Following", url: "https://x.com/following" }, { label: "Likes", url: "https://x.com/i/likes" }] },
  { id: "facebook", label: "Facebook", following: "none", liked: "none", note: "Facebook has no API for personal follows or likes. Open the pages instead.",
    pages: [{ label: "Following", url: "https://www.facebook.com/me/following" }, { label: "Likes", url: "https://www.facebook.com/me/likes" }] },
  { id: "instagram", label: "Instagram", following: "none", liked: "none", note: "Instagram's API is for business accounts only. Open the pages instead.",
    pages: [{ label: "Following", url: "https://www.instagram.com/accounts/access_tool/accounts_you_follow" }, { label: "Likes", url: "https://www.instagram.com/your_activity/interactions/likes" }] },
];

const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
const s = (v: unknown): string => (typeof v === "string" ? v : "");
const https = (u: string): string | null => (/^https:\/\//.test(u) ? u : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export const URLS = {
  twitchFollowed: (uid: string) => `https://api.twitch.tv/helix/channels/followed?user_id=${encodeURIComponent(uid)}&first=100`,
  ytSubs: "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50",
  ytLiked: "https://www.googleapis.com/youtube/v3/videos?part=snippet&myRating=like&maxResults=50",
  redditSubs: "https://oauth.reddit.com/subreddits/mine/subscriber?limit=100&raw_json=1",
  redditUpvoted: (user: string) => `https://oauth.reddit.com/user/${encodeURIComponent(user)}/upvoted?limit=50&raw_json=1`,
  mastoFollowing: (base: string, id: string) => `${base}/api/v1/accounts/${encodeURIComponent(id)}/following?limit=80`,
  mastoFavs: (base: string) => `${base}/api/v1/favourites?limit=40`,
  bskyFollows: (did: string) => `https://bsky.social/xrpc/app.bsky.graph.getFollows?actor=${encodeURIComponent(did)}&limit=100`,
  bskyLikes: (did: string) => `https://bsky.social/xrpc/app.bsky.feed.getActorLikes?actor=${encodeURIComponent(did)}&limit=50`,
  ghFollowing: "https://api.github.com/user/following?per_page=100",
  ghStarred: "https://api.github.com/user/starred?per_page=100",
};

export const parseTwitchFollowed = (j: unknown): FollowItem[] =>
  arr(obj(j).data).map((d) => ({ title: s(d.broadcaster_name) || s(d.broadcaster_login), subtitle: s(d.followed_at).slice(0, 10), url: s(d.broadcaster_login) ? `https://www.twitch.tv/${s(d.broadcaster_login)}` : null }));

export const parseYtSubs = (j: unknown): FollowItem[] =>
  arr(obj(j).items).map((it) => { const sn = obj(it.snippet); const ch = s(obj(sn.resourceId).channelId); return { title: s(sn.title), url: ch ? `https://www.youtube.com/channel/${ch}` : null }; });

export const parseYtLiked = (j: unknown): FollowItem[] =>
  arr(obj(j).items).map((it) => { const sn = obj(it.snippet); return { title: s(sn.title), subtitle: s(sn.channelTitle), url: s(it.id) ? `https://www.youtube.com/watch?v=${s(it.id)}` : null }; });

export const parseRedditSubs = (j: unknown): FollowItem[] =>
  arr(obj(obj(j).data).children).map((c) => { const d = obj(c.data); return { title: s(d.display_name_prefixed), subtitle: s(d.public_description).slice(0, 120), url: s(d.url) ? `https://www.reddit.com${s(d.url)}` : null }; });

export const parseRedditPosts = (j: unknown): FollowItem[] =>
  arr(obj(obj(j).data).children).map((c) => { const d = obj(c.data); return { title: s(d.title), subtitle: s(d.subreddit_name_prefixed), url: s(d.permalink) ? `https://www.reddit.com${s(d.permalink)}` : null }; });

export const parseMastoAccounts = (j: unknown): FollowItem[] =>
  arr(j).map((a) => ({ title: s(a.display_name) || s(a.acct), subtitle: `@${s(a.acct)}`, url: https(s(a.url)) }));

export const parseMastoStatuses = (j: unknown): FollowItem[] =>
  arr(j).map((st) => ({ title: s(st.content).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) || "(media post)", subtitle: `@${s(obj(st.account).acct)}`, url: https(s(st.url)) }));

export const parseBskyFollows = (j: unknown): FollowItem[] =>
  arr(obj(j).follows).map((f) => ({ title: s(f.displayName) || s(f.handle), subtitle: `@${s(f.handle)}`, url: s(f.handle) ? `https://bsky.app/profile/${s(f.handle)}` : null }));

export const parseBskyLikes = (j: unknown): FollowItem[] =>
  arr(obj(j).feed).map((it) => {
    const p = obj(it.post); const a = obj(p.author); const rkey = s(p.uri).split("/").pop() ?? "";
    return { title: s(obj(p.record).text).slice(0, 140) || "(post)", subtitle: `@${s(a.handle)}`, url: s(a.handle) && rkey ? `https://bsky.app/profile/${s(a.handle)}/post/${rkey}` : null };
  });

export const parseGhUsers = (j: unknown): FollowItem[] => arr(j).map((u) => ({ title: s(u.login), url: https(s(u.html_url)) }));
export const parseGhRepos = (j: unknown): FollowItem[] => arr(j).map((r) => ({ title: s(r.full_name), subtitle: s(r.description).slice(0, 120), url: https(s(r.html_url)) }));

/** A friendly reason for a failed load. */
export function followError(label: string, status: number | null, msg = ""): string {
  if (/not connected|Connect in Settings|missing credential|no .* configured/i.test(msg)) return `${label} is not connected. Connect it in Settings > Accounts (Bluesky: Social > Accounts).`;
  if (status === 401 || status === 403) return `${label} refused (HTTP ${status}): the sign-in lacks a permission or expired. Press Connect again in Settings > Accounts.`;
  if (status) return `${label} answered HTTP ${status}.`;
  return `${label}: ${msg.slice(0, 200) || "failed"}`;
}
