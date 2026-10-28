import { fetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCredential, setCredential } from "../../core/credentials";

const MODULE_ID = "hub.social";

export interface SocialPost {
  postId: string;
  author: string;
  text: string;
  link: string | null;
  postedAt: string | null;
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
  // the only option; still gated behind a one-time "Connect" action.
  authType: "oauth" | "manual";
  credentials: CredentialSpec[]; // manual: entered by hand; oauth: pre-reqs only (e.g. instance URL)
  connect?: () => Promise<void>; // oauth connectors only
  fetchFeed(): Promise<SocialPost[]>;
}

async function cred(platform: string, key: string): Promise<string> {
  const v = await getCredential(MODULE_ID, `${platform}_${key}`);
  if (!v) throw new Error(`not connected yet — click "Connect" for this platform first`);
  return v;
}

// --- Bluesky --- AT Protocol has no public-client OAuth that a desktop app
// can use without hosting a client-metadata JSON at a public HTTPS URL, so
// true one-click sign-in isn't possible here yet. One-time handle + app
// password (never your real password — generated at bsky.app Settings →
// App Passwords), re-authenticated per fetch rather than caching a session.
const bluesky: SocialConnector = {
  id: "bluesky",
  label: "Bluesky",
  authType: "manual",
  credentials: [
    { key: "handle", label: "Handle (e.g. you.bsky.social)" },
    { key: "app_password", label: "App password (Settings → App Passwords, not your real password)" },
  ],
  async fetchFeed() {
    const handle = await cred("bluesky", "handle");
    const appPassword = await cred("bluesky", "app_password");

    const session = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: handle, password: appPassword }),
    });
    if (!session.ok) throw new Error(`Bluesky login failed: ${session.status}`);
    const { accessJwt } = (await session.json()) as { accessJwt: string };

    const res = await fetch("https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=30", {
      headers: { Authorization: `Bearer ${accessJwt}` },
    });
    if (!res.ok) throw new Error(`Bluesky feed fetch failed: ${res.status}`);
    const data = (await res.json()) as {
      feed: { post: { uri: string; author: { handle: string }; record: { text: string; createdAt: string } } }[];
    };
    return data.feed.map(({ post }) => ({
      postId: post.uri,
      author: post.author.handle,
      text: post.record.text,
      link: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`,
      postedAt: post.record.createdAt,
    }));
  },
};

// --- Mastodon --- real one-click OAuth: Mastodon instances let any app
// dynamically self-register (no pre-made developer account needed), so
// "Connect" does the whole thing — register this install with your
// instance, open your browser to approve, catch the redirect, done. Only
// upfront input is which instance you're on.
const mastodonPort = 53683;
const mastodon: SocialConnector = {
  id: "mastodon",
  label: "Mastodon",
  authType: "oauth",
  credentials: [{ key: "instance_url", label: "Instance URL (e.g. https://mastodon.social)" }],
  async connect() {
    const instanceUrl = await cred("mastodon", "instance_url").catch(() => {
      throw new Error('enter your instance URL above first, then click "Connect"');
    });
    const base = instanceUrl.replace(/\/+$/, "");
    const redirectUri = `http://127.0.0.1:${mastodonPort}`;

    const appRes = await fetch(`${base}/api/v1/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Sentinel Hub",
        redirect_uris: redirectUri,
        scopes: "read",
      }),
    });
    if (!appRes.ok) throw new Error(`couldn't register with ${base}: ${appRes.status}`);
    const app = (await appRes.json()) as { client_id: string; client_secret: string };

    const authUrl = new URL(`${base}/oauth/authorize`);
    authUrl.searchParams.set("client_id", app.client_id);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "read");

    const codePromise = invoke<string>("oauth_listen_once", {
      port: mastodonPort,
      timeoutSecs: 120,
    });
    await openUrl(authUrl.toString());
    const code = await codePromise;

    const tokenRes = await fetch(`${base}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: app.client_id,
        client_secret: app.client_secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code,
        scope: "read",
      }).toString(),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as { access_token: string };

    await setCredential(MODULE_ID, "mastodon_instance_url", base);
    await setCredential(MODULE_ID, "mastodon_access_token", tokens.access_token);
  },
  async fetchFeed() {
    const base = await cred("mastodon", "instance_url");
    const token = await cred("mastodon", "access_token");
    const res = await fetch(`${base}/api/v1/timelines/home?limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Mastodon fetch failed: ${res.status}`);
    const data = (await res.json()) as {
      id: string;
      account: { acct: string };
      content: string;
      url: string;
      created_at: string;
    }[];
    return data.map((p) => ({
      postId: p.id,
      author: p.account.acct,
      text: p.content.replace(/<[^>]+>/g, ""),
      link: p.url,
      postedAt: p.created_at,
    }));
  },
};

// --- Reddit --- one-click OAuth, but Reddit (unlike Mastodon) doesn't
// support dynamic app registration — you create one "installed app" once at
// reddit.com/prefs/apps (redirect URI below), paste its Client ID in above,
// then every sign-in after that is just "Connect" → browser → approve.
// No password is ever entered or stored.
const redditPort = 53684;
const reddit: SocialConnector = {
  id: "reddit",
  label: "Reddit",
  authType: "oauth",
  credentials: [
    {
      key: "client_id",
      label: "Client ID (create an \"installed app\" at reddit.com/prefs/apps)",
    },
  ],
  async connect() {
    const clientId = await cred("reddit", "client_id").catch(() => {
      throw new Error('enter your Reddit app Client ID above first, then click "Connect"');
    });
    const redirectUri = `http://127.0.0.1:${redditPort}`;
    const state = crypto.randomUUID();

    const authUrl = new URL("https://www.reddit.com/api/v1/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("duration", "permanent");
    authUrl.searchParams.set("scope", "read identity");

    const codePromise = invoke<string>("oauth_listen_once", {
      port: redditPort,
      timeoutSecs: 120,
    });
    await openUrl(authUrl.toString());
    const code = await codePromise;

    // Reddit's "installed app" type has no client secret — Basic auth with
    // an empty password, as their docs specify for this app type.
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "sentinel-hub/0.1 (desktop app)",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!tokenRes.ok) throw new Error(`Reddit token exchange failed: ${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string };

    await setCredential(MODULE_ID, "reddit_client_id", clientId);
    await setCredential(MODULE_ID, "reddit_access_token", tokens.access_token);
    if (tokens.refresh_token) {
      await setCredential(MODULE_ID, "reddit_refresh_token", tokens.refresh_token);
    }
  },
  async fetchFeed() {
    const token = await cred("reddit", "access_token");
    const res = await fetch("https://oauth.reddit.com/best?limit=30", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "sentinel-hub/0.1 (desktop app)" },
    });
    if (!res.ok) throw new Error(`Reddit feed fetch failed: ${res.status}`);
    const data = (await res.json()) as {
      data: { children: { data: { id: string; author: string; title: string; permalink: string; created_utc: number } }[] };
    };
    return data.data.children.map(({ data: p }) => ({
      postId: p.id,
      author: p.author,
      text: p.title,
      link: `https://reddit.com${p.permalink}`,
      postedAt: new Date(p.created_utc * 1000).toISOString(),
    }));
  },
};

// --- X (Twitter) --- stubbed: the free API tier has no usable read
// endpoint, and the paid tiers need a developer account + billing. Listed so
// the architecture visibly supports it; fill in `connect`/`fetchFeed` here
// once you have API access.
const x: SocialConnector = {
  id: "x",
  label: "X (Twitter)",
  authType: "manual",
  credentials: [],
  async fetchFeed() {
    throw new Error(
      "X's free API tier has no usable read endpoint — needs a paid developer account. Not built yet."
    );
  },
};

export const connectors: SocialConnector[] = [bluesky, mastodon, reddit, x];
