import { fetch } from "@tauri-apps/plugin-http";
import { cred } from "./common";
import { parseBluesky } from "./parse";
import type { SocialConnector } from "./types";

// AT Protocol has no public-client OAuth a desktop app can use without
// hosting client metadata at a public HTTPS URL, so: handle + app password
// (never your real password), re-authenticated per call, no cached session.
async function session(): Promise<{ accessJwt: string; did: string }> {
  const identifier = await cred("bluesky", "handle");
  const password = await cred("bluesky", "app_password");
  const res = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error(`Bluesky login failed: ${res.status}`);
  return (await res.json()) as { accessJwt: string; did: string };
}

export const bluesky: SocialConnector = {
  id: "bluesky",
  label: "Bluesky",
  authType: "manual",
  connectedKey: "app_password",
  credentials: [
    { key: "handle", label: "Handle (e.g. you.bsky.social)" },
    { key: "app_password", label: "App password (Settings → App Passwords, not your real password)" },
  ],
  async fetchFeed() {
    const { accessJwt } = await session();
    const res = await fetch("https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=50", {
      headers: { Authorization: `Bearer ${accessJwt}` },
    });
    if (!res.ok) throw new Error(`Bluesky feed fetch failed: ${res.status}`);
    return parseBluesky(await res.json());
  },
  async post(text) {
    const { accessJwt, did } = await session();
    const res = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessJwt}` },
      body: JSON.stringify({
        repo: did,
        collection: "app.bsky.feed.post",
        record: { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString() },
      }),
    });
    if (!res.ok) throw new Error(`Bluesky post failed: ${res.status}`);
  },
};
