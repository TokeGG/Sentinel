import { fetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { setCredential } from "../../../core/credentials";
import { MODULE_ID, UA, cred } from "./common";
import { parseReddit } from "./parse";
import type { SocialConnector } from "./types";

// One-click OAuth, but Reddit has no dynamic app registration: create one
// "installed app" at reddit.com/prefs/apps (redirect URI below), paste its
// Client ID, then every sign-in is just "Connect". Read-only (no submit scope).
const PORT = 53684;

export const reddit: SocialConnector = {
  id: "reddit",
  label: "Reddit",
  authType: "oauth",
  connectedKey: "access_token",
  credentials: [{ key: "client_id", label: 'Client ID (create an "installed app" at reddit.com/prefs/apps)' }],
  async connect() {
    const clientId = await cred("reddit", "client_id").catch(() => {
      throw new Error('enter your Reddit app Client ID above first, then click "Connect"');
    });
    const redirectUri = `http://127.0.0.1:${PORT}`;

    const authUrl = new URL("https://www.reddit.com/api/v1/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", crypto.randomUUID());
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("duration", "permanent");
    authUrl.searchParams.set("scope", "read identity");

    const codePromise = invoke<string>("oauth_listen_once", { port: PORT, timeoutSecs: 120 });
    await openUrl(authUrl.toString());
    const code = await codePromise;

    // "Installed app" type has no client secret — Basic auth with an empty password.
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
    });
    if (!tokenRes.ok) throw new Error(`Reddit token exchange failed: ${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string };

    await setCredential(MODULE_ID, "reddit_client_id", clientId);
    await setCredential(MODULE_ID, "reddit_access_token", tokens.access_token);
    if (tokens.refresh_token) await setCredential(MODULE_ID, "reddit_refresh_token", tokens.refresh_token);
  },
  async fetchFeed() {
    const token = await cred("reddit", "access_token");
    const res = await fetch("https://oauth.reddit.com/best?limit=40", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
    });
    if (res.status === 401) throw new Error('Reddit token expired — click "Connect Reddit" again');
    if (!res.ok) throw new Error(`Reddit feed fetch failed: ${res.status}`);
    return parseReddit(await res.json());
  },
};
