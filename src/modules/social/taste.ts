// Social post -> taste item: platform, author handle and text keywords.
import { itemFeatures } from "../../core/taste/features.ts";
import type { TasteItem } from "../../core/taste/model.ts";
import type { FeedPost } from "./panelLogic.ts";

export const socialTaste = (p: Pick<FeedPost, "platform" | "postId" | "handle" | "text">): TasteItem => ({
  key: `soc:${p.platform}:${p.postId}`,
  features: itemFeatures({ source: p.platform, sender: p.handle.replace(/^[@u/]+/, ""), text: p.text }),
});
