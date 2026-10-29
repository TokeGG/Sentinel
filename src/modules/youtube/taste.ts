// YouTube video -> taste item (channel + title keywords); feeds the shared profile
// that recommend.ts adds as one extra score term.
import { itemFeatures } from "../../core/taste/features.ts";
import type { TasteItem } from "../../core/taste/model.ts";

export const videoTaste = (v: { videoId: string; channelId: string | null; channel: string; title: string }): TasteItem => ({
  key: `yt:${v.videoId}`,
  features: itemFeatures({ channel: v.channelId || v.channel, text: v.title }),
});
