import { fetch } from "@tauri-apps/plugin-http";
import { UA } from "./common";
import { connectReddit, isConnected, redditToken } from "./accountToken";
import { redditCommentBody, redditCommentError, redditVoteBody } from "./actions";
import { parseReddit } from "./parse";
import type { PostRef, SocialConnector } from "./types";

// Loopback sign-in via core/connect: one "installed app" Client ID (Settings > Accounts or the field here), then just "Connect".

// POST to oauth.reddit.com/api/<name> (form-encoded); returns the JSON body.
async function api(name: "vote" | "comment", body: string): Promise<unknown> {
  const token = await redditToken();
  const res = await fetch(`https://oauth.reddit.com/api/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (res.status === 401 || res.status === 403) throw new Error('Reddit refused — click "Connect Reddit" again to grant voting and commenting');
  if (!res.ok) throw new Error(`Reddit ${name} failed: ${res.status}`);
  return res.json().catch(() => ({}));
}

export const reddit: SocialConnector = {
  id: "reddit",
  label: "Reddit",
  authType: "oauth",
  connectedKey: "access_token",
  credentials: [{ key: "client_id", label: 'Client ID (create an "installed app" at reddit.com/prefs/apps)' }],
  connect: connectReddit,
  isConnected: () => isConnected("reddit"),
  async fetchFeed() {
    const token = await redditToken();
    const res = await fetch("https://oauth.reddit.com/best?limit=40", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
    });
    if (res.status === 401) throw new Error('Reddit token expired — click "Connect Reddit" again');
    if (!res.ok) throw new Error(`Reddit feed fetch failed: ${res.status}`);
    return parseReddit(await res.json());
  },
  async like(p: PostRef) {
    await api("vote", redditVoteBody(p, 1));
    return { liked: true };
  },
  async unlike(p: PostRef) {
    await api("vote", redditVoteBody(p, 0));
    return { liked: false };
  },
  async reply(p: PostRef, text: string) {
    const err = redditCommentError(await api("comment", redditCommentBody(p, text)));
    if (err) throw new Error(`Reddit: ${err}`);
  },
};
