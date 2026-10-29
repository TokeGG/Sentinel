// Live/upcoming streams from your channels: fetch each channel's /live page (consent
// cookies as in store.ts), parse it (live.ts), keep the hits in app_settings `yt_live`.
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { getSetting, setSetting } from "../../ui/appSetting";
import { LIVE_KEY, liveUrl, parseLivePage, sanitizeLive, type LiveHit } from "./live";
import { refreshFeeds } from "./store";

const HEADERS = { "Accept-Language": "en", Cookie: "SOCS=CAI; CONSENT=YES+1" };

export const loadLive = async (): Promise<LiveHit[]> => sanitizeLive(await getSetting(LIVE_KEY));

export async function checkLive() {
  const d = await getDb();
  const chans = await d.select<{ channel_id: string; title: string }[]>("SELECT channel_id, title FROM youtube_channels");
  const hits: LiveHit[] = [];
  let failed = 0;
  for (const c of chans) {
    try {
      const res = await fetch(liveUrl(c.channel_id), { headers: HEADERS });
      if (!res.ok) { failed++; continue; }
      const p = parseLivePage(await res.text());
      if (p) hits.push({ ...p, channelId: c.channel_id, title: p.title || c.title, checkedAt: Date.now() });
    } catch {
      failed++;
    }
  }
  await setSetting(LIVE_KEY, JSON.stringify(hits));
  await logActivity("youtube", "check_live", `checked ${chans.length} channel(s)`, `${hits.length} live/upcoming${failed ? `, ${failed} failed` : ""}`);
  return { live: hits.filter((h) => h.status === "live").length, upcoming: hits.filter((h) => h.status === "upcoming").length, failed };
}

/** Scheduled refresh (only when the module's Auto-refresh toggle is on): feeds, then live. */
export async function refreshAll() {
  const feeds = await refreshFeeds();
  return { ...feeds, ...(await checkLive()) };
}
