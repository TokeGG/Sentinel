import { fetch } from "@tauri-apps/plugin-http";
import { cred } from "./common";
import { bskyCreatedUri, bskyDelete, bskyLike, bskyReply, bskyRepost } from "./actions";
import { parseBluesky } from "./parse";
import { parseBskyNotifications } from "./inboxParse";
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

// One authenticated repo write (createRecord / deleteRecord); returns the JSON body.
async function xrpc(name: "createRecord" | "deleteRecord", body: object): Promise<unknown> {
  const { accessJwt } = await session();
  const res = await fetch(`https://bsky.social/xrpc/com.atproto.repo.${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessJwt}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Bluesky ${name} failed: ${res.status}`);
  return res.json().catch(() => ({}));
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
  async fetchInbox() {
    const { accessJwt } = await session();
    const res = await fetch("https://bsky.social/xrpc/app.bsky.notification.listNotifications?limit=50", { headers: { Authorization: `Bearer ${accessJwt}` } });
    if (!res.ok) throw new Error(`Bluesky notifications failed: ${res.status}`);
    return parseBskyNotifications(await res.json());
  },
  async post(text) {
    const { did } = await session();
    await xrpc("createRecord", { repo: did, collection: "app.bsky.feed.post", record: { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString() } });
  },
  async like(p) {
    const { did } = await session();
    return { liked: true, likeUri: bskyCreatedUri(await xrpc("createRecord", bskyLike(did, p))) };
  },
  async unlike(p) {
    const { did } = await session();
    await xrpc("deleteRecord", bskyDelete(did, p.meta.likeUri));
    return { liked: false, likeUri: undefined };
  },
  async share(p) {
    const { did } = await session();
    return { shared: true, shareUri: bskyCreatedUri(await xrpc("createRecord", bskyRepost(did, p))) };
  },
  async unshare(p) {
    const { did } = await session();
    await xrpc("deleteRecord", bskyDelete(did, p.meta.shareUri));
    return { shared: false, shareUri: undefined };
  },
  async reply(p, text) {
    const { did } = await session();
    await xrpc("createRecord", bskyReply(did, p, text));
  },
};
