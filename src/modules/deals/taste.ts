// Deals -> taste item: source, category, store, price band, tag and title keywords.
import { itemFeatures } from "../../core/taste/features.ts";
import type { TasteItem } from "../../core/taste/model.ts";
import { sourceLabel } from "../news/panelLogic.ts";
import { dealInfo, storeOf, tagOf } from "./price.ts";

export function dealTaste(r: Record<string, unknown>): TasteItem {
  const title = String(r.title ?? "");
  const tag = tagOf(title);
  return {
    key: `deal:${r.id}`,
    features: itemFeatures({
      source: sourceLabel(r), category: typeof r.category === "string" ? r.category : null,
      store: storeOf(title), price: dealInfo(title).band, text: title, extra: tag ? [`tag:${tag.toLowerCase()}`] : [],
    }),
  };
}
