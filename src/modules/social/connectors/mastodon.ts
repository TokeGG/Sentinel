import { fetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { setCredential } from "../../../core/credentials";
import { MODULE_ID, cred } from "./common";
import { parseMastodon } from "./parse";
import type { SocialConnector } from "./types";

// Real one-click OAuth: instances let any app self-register, so "Connect"
// registers this install, opens the browser to approve, catches the redirect
// (generic oauth_listen_once). Only upfront input is the instance. Scopes:
// read + write:statuses (posting); accounts connected before posting existed
// must click Connect again.
const PORT = 53683;
const SCOPE = "read write:statuses";

export const mastodon: SocialConnector = {
  id: "mastodon",
  label: "Mastodon",
  authType: "oauth",
  connectedKey: "access_token",
  credentials: [{ key: "instance_url", label: "Instance URL (e.g. https://mastodon.social)" }],
  async connect() {
    const instanceUrl = await cred("mastodon", "instance_url").catch(() => {
      throw new Error('enter your instance URL above first, then click "Connect"');
    });
    const base = instanceUrl.replace(/\/+$/, "");
    const redirectUri = `http://127.0.0.1:${PORT}`;

    const appRes = await fetch(`${base}/api/v1/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "Sentinel Hub", redirect_uris: redirectUri, scopes: SCOPE }),
    });
    if (!appRes.ok) throw new Error(`couldn't register with ${base}: ${appRes.status}`);
    const app = (await appRes.json()) as { client_id: string; client_secret: string };

    const authUrl = new URL(`${base}/oauth/authorize`);
    authUrl.searchParams.set("client_id", app.client_id);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPE);

    const codePromise = invoke<string>("oauth_listen_once", { port: PORT, timeoutSecs: 120 });
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
        scope: SCOPE,
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
    const res = await fetch(`${base}/api/v1/timelines/home?limit=40`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Mastodon fetch failed: ${res.status}`);
    return parseMastodon(await res.json());
  },
  async post(text) {
    const base = await cred("mastodon", "instance_url");
    const token = await cred("mastodon", "access_token");
    const res = await fetch(`${base}/api/v1/statuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: text }),
    });
    if (res.status === 403) throw new Error('Mastodon post refused — click "Connect Mastodon" again to grant posting');
    if (!res.ok) throw new Error(`Mastodon post failed: ${res.status}`);
  },
};
