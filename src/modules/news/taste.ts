// News -> taste item: source plus title keywords.
import { itemFeatures } from "../../core/taste/features.ts";
import type { TasteItem } from "../../core/taste/model.ts";
import { sourceLabel } from "./panelLogic.ts";

export const newsTaste = (r: Record<string, unknown>): TasteItem => ({
  key: `news:${r.id}`,
  features: itemFeatures({ source: sourceLabel(r), text: String(r.title ?? "") }),
});
