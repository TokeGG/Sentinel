// Pure: YouTube's per-channel Atom feed -> videos, via the shared news parser helpers.
import { blocks, tag } from "../news/rss.ts";

export interface YtVideo {
  videoId: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
}
export interface YtFeed {
  channelId: string | null;
  title: string | null;
  videos: YtVideo[];
}

export function parseYtFeed(xml: string): YtFeed {
  const entries = blocks(xml, "entry");
  const head = entries.reduce((x, e) => x.replace(e, ""), xml);
  const videos: YtVideo[] = [];
  for (const e of entries) {
    const videoId = tag(e, "yt:videoId");
    if (!videoId) continue;
    videos.push({
      videoId,
      title: tag(e, "title") || "(untitled)",
      author: tag(e, "name"),
      publishedAt: tag(e, "published"),
    });
  }
  return { channelId: tag(head, "yt:channelId"), title: tag(head, "title"), videos };
}
