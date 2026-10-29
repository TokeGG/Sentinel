// I/O for "Following & Likes": one loader per platform, using the existing sign-ins
// (core/connect tokens, Bluesky app password, GitHub PAT). Runs only on a button press.
import { fetch } from "@tauri-apps/plugin-http";
import { getAccessToken, primaryAccount } from "../../core/connect";
import { clientIdFor } from "../../core/connect/clientStore";
import { authHeaders } from "../github/auth";
import { mastoAuth, redditToken } from "./connectors/accountToken";
import { session } from "./connectors/bluesky";
import * as F from "./follows";

export class HttpStatus extends Error { constructor(public status: number, url: string) { super(`${new URL(url).host} answered HTTP ${status}`); } }

async function get(url: string, headers: Record<string, string>): Promise<unknown> {
  const r = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!r.ok) throw new HttpStatus(r.status, url);
  return r.json();
}
const UA = { "User-Agent": "sentinel-hub/0.1 (desktop app)" };

const LOADERS: Record<string, () => Promise<F.FollowLists>> = {
  async twitch() {
    const token = await getAccessToken("twitch");
    const v = (await get("https://id.twitch.tv/oauth2/validate", { Authorization: `OAuth ${token}` })) as { user_id?: string };
    if (!v.user_id) throw new Error("Twitch token is invalid; Connect in Settings > Accounts again.");
    const following = F.parseTwitchFollowed(await get(F.URLS.twitchFollowed(v.user_id), { Authorization: `Bearer ${token}`, "Client-Id": await clientIdFor("twitch") }));
    return { following, liked: [] };
  },
  async youtube() {
    const h = { Authorization: `Bearer ${await getAccessToken("google-youtube")}` };
    return { following: F.parseYtSubs(await get(F.URLS.ytSubs, h)), liked: F.parseYtLiked(await get(F.URLS.ytLiked, h)) };
  },
  async reddit() {
    const h = { Authorization: `Bearer ${await redditToken()}`, ...UA };
    const me = (await get("https://oauth.reddit.com/api/v1/me", h)) as { name?: string };
    const following = F.parseRedditSubs(await get(F.URLS.redditSubs, h));
    const liked = me.name ? F.parseRedditPosts(await get(F.URLS.redditUpvoted(me.name), h)) : [];
    return { following, liked };
  },
  async mastodon() {
    const { token, base } = await mastoAuth();
    const h = { Authorization: `Bearer ${token}` };
    const me = (await get(`${base}/api/v1/accounts/verify_credentials`, h)) as { id?: string };
    return { following: me.id ? F.parseMastoAccounts(await get(F.URLS.mastoFollowing(base, me.id), h)) : [], liked: F.parseMastoStatuses(await get(F.URLS.mastoFavs(base), h)) };
  },
  async bluesky() {
    const { accessJwt, did } = await session();
    const h = { Authorization: `Bearer ${accessJwt}` };
    return { following: F.parseBskyFollows(await get(F.URLS.bskyFollows(did), h)), liked: F.parseBskyLikes(await get(F.URLS.bskyLikes(did), h)) };
  },
  async github() {
    const h = await authHeaders().catch(() => ({} as Record<string, string>));
    if (!h.Authorization) throw new Error("GitHub is not connected. Connect in Settings > Accounts.");
    const gh = { ...h, Accept: "application/vnd.github+json" };
    return { following: F.parseGhUsers(await get(F.URLS.ghFollowing, gh)), liked: F.parseGhRepos(await get(F.URLS.ghStarred, gh)) };
  },
};

/** Loads one platform; errors come back as a friendly message (never a token). */
export async function loadFollows(id: string): Promise<F.FollowLists> {
  const p = F.FOLLOW_PLATFORMS.find((x) => x.id === id);
  const fn = LOADERS[id];
  if (!p || !fn) throw new Error("This platform has no API for follows or likes.");
  try {
    return await fn();
  } catch (e) {
    throw new Error(F.followError(p.label, e instanceof HttpStatus ? e.status : null, e instanceof Error ? e.message : String(e)));
  }
}

/** Which platforms look connected (cheap, local only). */
export async function connectedIds(): Promise<Set<string>> {
  const out = new Set<string>();
  for (const [id, prov] of [["twitch", "twitch"], ["youtube", "google-youtube"], ["reddit", "reddit"], ["mastodon", "mastodon"], ["github", "github"]] as const)
    if (await primaryAccount(prov).catch(() => null)) out.add(id);
  return out;
}
