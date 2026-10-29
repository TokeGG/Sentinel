import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { getCredential, setCredential } from "../../core/credentials";
import { registerModule, type ModuleManifest } from "../../core/module";
import { generateCodeVerifier, codeChallengeFromVerifier } from "./pkce";

const MODULE_ID = "hub.youtube";
const REDIRECT_PORT = 53682; // arbitrary fixed loopback port, registered below
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}`;
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface SubRow extends Record<string, unknown> {
  id: number;
  channel_id: string;
  channel_title: string;
  uploads_playlist_id: string | null;
}

interface VideoRow extends Record<string, unknown> {
  id: number;
  channel_id: string;
  video_id: string;
  title: string;
  published_at: string | null;
}

async function clientId(): Promise<string> {
  const id = await getCredential(MODULE_ID, "client_id");
  if (!id) throw new Error("add your Google OAuth Client ID above first");
  return id;
}

// One-time per machine: opens the system browser for Google sign-in, catches
// the redirect on a loopback port, exchanges the code for tokens. No client
// secret — a Desktop-app OAuth client is a public client under PKCE, which
// is exactly why only the Client ID (not a secret) was needed from you.
async function connect() {
  const id = await clientId();
  const verifier = generateCodeVerifier();
  const challenge = await codeChallengeFromVerifier(verifier);

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set("client_id", id);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  const codePromise = invoke<string>("oauth_listen_once", {
    port: REDIRECT_PORT,
    timeoutSecs: 120,
  });
  await openUrl(authUrl.toString());
  const code = await codePromise;

  const body = new URLSearchParams({
    client_id: id,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const tokens = (await res.json()) as { access_token: string; refresh_token?: string };

  if (tokens.refresh_token) {
    await setCredential(MODULE_ID, "refresh_token", tokens.refresh_token);
  }
  await setCredential(MODULE_ID, "access_token", tokens.access_token);
  await logActivity("youtube", "connect", "OAuth sign-in", "ok");
  return { ok: true };
}

async function accessToken(): Promise<string> {
  const existing = await getCredential(MODULE_ID, "access_token");
  if (existing) return existing;

  const refresh = await getCredential(MODULE_ID, "refresh_token");
  if (!refresh) throw new Error('not connected — click "Connect Google Account" first');

  const id = await clientId();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
  const tokens = (await res.json()) as { access_token: string };
  await setCredential(MODULE_ID, "access_token", tokens.access_token);
  return tokens.access_token;
}

interface SubApiItem {
  snippet: { title: string; resourceId: { channelId: string }; thumbnails?: { default?: { url: string } } };
}

// MVP scope: lists subscribed channels. Polling each channel's own uploads
// for "new since last check" is the natural next increment, deferred so
// this ships now rather than waiting on quota-budgeted per-channel polling.
async function fetchSubscriptions() {
  const token = await accessToken();
  const d = await getDb();
  let pageToken: string | undefined;
  let count = 0;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/subscriptions");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
    const data = (await res.json()) as { items: SubApiItem[]; nextPageToken?: string };

    for (const item of data.items) {
      await d.execute(
        `INSERT INTO youtube_subscriptions (channel_id, channel_title, thumbnail_url)
         VALUES ($1, $2, $3)
         ON CONFLICT(channel_id) DO UPDATE SET channel_title = $2, fetched_at = datetime('now')`,
        [item.snippet.resourceId.channelId, item.snippet.title, item.snippet.thumbnails?.default?.url ?? null]
      );
      count++;
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  await logActivity("youtube", "fetch_subscriptions", "synced subscriptions", `${count} channel(s)`);
  return { ok: true, count };
}

// Resolves each subscribed channel's "uploads" playlist id (one batched
// channels.list call, up to 50 ids at a time) — needed once per channel,
// cached in the subscription row from then on.
async function resolveUploadsPlaylists(): Promise<void> {
  const d = await getDb();
  const unresolved = await d.select<{ channel_id: string }[]>(
    "SELECT channel_id FROM youtube_subscriptions WHERE uploads_playlist_id IS NULL"
  );
  if (unresolved.length === 0) return;
  const token = await accessToken();

  for (let i = 0; i < unresolved.length; i += 50) {
    const batch = unresolved.slice(i, i + 50).map((r) => r.channel_id);
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("id", batch.join(","));
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
    const data = (await res.json()) as {
      items: { id: string; contentDetails: { relatedPlaylists: { uploads: string } } }[];
    };
    for (const item of data.items) {
      await d.execute(
        "UPDATE youtube_subscriptions SET uploads_playlist_id = $1 WHERE channel_id = $2",
        [item.contentDetails.relatedPlaylists.uploads, item.id]
      );
    }
  }
}

// Per-channel "new upload" polling — the increment the MVP deferred. Pulls
// the 5 most recent videos per channel's uploads playlist; dedupe is the
// `video_id UNIQUE` constraint, so repeat calls are cheap no-ops for videos
// already seen.
async function fetchNewUploads() {
  await resolveUploadsPlaylists();
  const token = await accessToken();
  const d = await getDb();
  const subs = await d.select<SubRow[]>(
    "SELECT * FROM youtube_subscriptions WHERE uploads_playlist_id IS NOT NULL"
  );

  let newCount = 0;
  for (const sub of subs) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", sub.uploads_playlist_id!);
    url.searchParams.set("maxResults", "5");
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) continue; // one channel failing (deleted, private) shouldn't block the rest

    const data = (await res.json()) as {
      items: { snippet: { resourceId: { videoId: string }; title: string; publishedAt: string } }[];
    };
    for (const item of data.items) {
      const result = await d.execute(
        `INSERT OR IGNORE INTO youtube_videos (channel_id, video_id, title, published_at)
         VALUES ($1, $2, $3, $4)`,
        [sub.channel_id, item.snippet.resourceId.videoId, item.snippet.title, item.snippet.publishedAt]
      );
      if (result.rowsAffected > 0) newCount++;
    }
  }

  await logActivity("youtube", "fetch_new_uploads", `checked ${subs.length} channel(s)`, `${newCount} new video(s)`);
  return { ok: true, newCount };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const videos = await d.select<VideoRow[]>(
    "SELECT * FROM youtube_videos ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT 100"
  );
  if (videos.length > 0) {
    return videos.map((v) => ({
      id: `v-${v.id}`,
      title: v.title,
      link: `https://www.youtube.com/watch?v=${v.video_id}`,
    }));
  }
  // Before the first "Check new uploads" run, fall back to the plain
  // channel list so the panel isn't empty right after connecting.
  const subs = await d.select<SubRow[]>("SELECT * FROM youtube_subscriptions ORDER BY channel_title ASC");
  return subs.map((r) => ({
    id: `c-${r.id}`,
    title: r.channel_title,
    link: `https://www.youtube.com/channel/${r.channel_id}`,
  }));
}

export const youtubeModule: ModuleManifest = {
  id: MODULE_ID,
  name: "YouTube",
  accent: "#ff6b6b",
  ring: "media",
  icon: "youtube",
  description:
    "Subscribed channels + per-channel new uploads via the official API. OAuth, no API key stored in plaintext.",
  panel: "list",
  skills: [
    { name: "connect", run: connect },
    { name: "fetch_subscriptions", run: fetchSubscriptions },
    { name: "fetch_new_uploads", run: fetchNewUploads },
  ],
  load: loadRows,
  actions: [
    { label: "Connect Google Account", skill: "connect" },
    { label: "Sync Subscriptions", skill: "fetch_subscriptions" },
    { label: "Check new uploads", skill: "fetch_new_uploads" },
  ],
  schedule: { skill: "fetch_new_uploads", intervalMinutes: 60 },
  credentialFields: [{ key: "client_id", label: "Google OAuth Client ID" }],
};

registerModule(youtubeModule);
