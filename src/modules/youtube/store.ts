// DB + network side of the YouTube module (no API key, no account): channel
// feeds are the public Atom feeds, channel pages are scraped for their id.
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { extractChannel, feedUrl, parseChannelInput } from "./channelUrl";
import { parseYtFeed } from "./feed";
import { libraryRows } from "./libraryStore";

// A consent cookie keeps EU requests from being redirected to a consent page.
const HEADERS = { "Accept-Language": "en", Cookie: "SOCS=CAI; CONSENT=YES+1" };

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

/** Fetch one channel's feed and store new videos; returns how many were new. */
async function ingest(channelId: string): Promise<{ title: string | null; added: number }> {
  const feed = parseYtFeed(await getText(feedUrl(channelId)));
  const d = await getDb();
  let added = 0;
  for (const v of feed.videos) {
    const r = await d.execute(
      "INSERT OR IGNORE INTO youtube_videos (channel_id, video_id, title, published_at) VALUES ($1, $2, $3, $4)",
      [channelId, v.videoId, v.title, v.publishedAt]
    );
    added += r.rowsAffected;
  }
  return { title: feed.title, added };
}

export async function addChannel(args?: Record<string, unknown>) {
  const input = parseChannelInput(String(args?.url ?? ""));
  if (!input) throw new Error("paste a YouTube channel or video URL, an @handle, or a UC… channel id");
  let id = input.id;
  let title: string | null = null;
  if (!id) {
    const found = extractChannel(await getText(input.pageUrl!));
    if (!found) throw new Error("could not find a channel id on that page — try the /channel/UC… URL");
    id = found.channelId;
    title = found.title;
  }
  const feed = await ingest(id);
  title = feed.title ?? title ?? input.handle ?? id;
  const d = await getDb();
  await d.execute(
    "INSERT INTO youtube_channels (channel_id, title, handle) VALUES ($1, $2, $3) ON CONFLICT(channel_id) DO UPDATE SET title = $2",
    [id, title, input.handle ?? null]
  );
  await logActivity("youtube", "add_channel", title, `${feed.added} video(s)`);
  return { ok: true, title };
}

export async function removeChannel(args?: Record<string, unknown>) {
  const id = String(args?.channelId ?? "");
  const d = await getDb();
  await d.execute("DELETE FROM youtube_videos WHERE channel_id = $1", [id]);
  await d.execute("DELETE FROM youtube_channels WHERE channel_id = $1", [id]);
  return { ok: true };
}

export async function refreshFeeds() {
  const d = await getDb();
  const chans = await d.select<{ channel_id: string }[]>("SELECT channel_id FROM youtube_channels");
  let added = 0;
  let failed = 0;
  for (const c of chans) {
    try {
      added += (await ingest(c.channel_id)).added;
    } catch {
      failed++; // one dead channel must not block the rest
    }
  }
  await logActivity("youtube", "refresh_feeds", `checked ${chans.length} channel(s)`, `${added} new${failed ? `, ${failed} failed` : ""}`);
  return { added, failed };
}

export async function loadRows(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const channels = await d.select<Record<string, unknown>[]>("SELECT * FROM youtube_channels ORDER BY title COLLATE NOCASE");
  const videos = await d.select<Record<string, unknown>[]>(
    `SELECT v.video_id, v.channel_id, v.title, v.published_at, c.title AS channel_title
     FROM youtube_videos v JOIN youtube_channels c ON c.channel_id = v.channel_id
     ORDER BY COALESCE(v.published_at, v.fetched_at) DESC LIMIT 300`
  );
  return [
    ...channels.map((r) => ({ ...r, kind: "channel" })),
    ...videos.map((r) => ({ ...r, kind: "video" })),
    ...(await libraryRows()),
  ];
}
