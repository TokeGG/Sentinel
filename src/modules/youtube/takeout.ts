// Pure: Google Takeout "watch-history.json" -> watched items.
export interface TakeoutItem {
  videoId: string;
  title: string;
  channelId: string | null;
  watchedAt: string | null; // ISO
}

const VID = /[?&]v=([\w-]{11})(?:[&#]|$)/;
const CH = /\/channel\/(UC[\w-]{22})/;

export function parseTakeout(text: string): TakeoutItem[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("not valid JSON — pick the watch-history.json from Google Takeout");
  }
  if (!Array.isArray(data)) throw new Error("expected a JSON array (watch-history.json)");
  const out: TakeoutItem[] = [];
  for (const raw of data) {
    const it = (raw ?? {}) as Record<string, unknown>;
    const videoId = typeof it.titleUrl === "string" ? VID.exec(it.titleUrl)?.[1] : undefined;
    if (!videoId) continue; // removed videos, ads, community posts
    const sub = Array.isArray(it.subtitles) ? (it.subtitles[0] as { url?: unknown } | undefined) : undefined;
    const time = typeof it.time === "string" && !Number.isNaN(Date.parse(it.time)) ? it.time : null;
    out.push({
      videoId,
      title: String(it.title ?? "").replace(/^Watched\s+/, "").trim() || "(untitled)",
      channelId: typeof sub?.url === "string" ? (CH.exec(sub.url)?.[1] ?? null) : null,
      watchedAt: time,
    });
  }
  return out;
}
