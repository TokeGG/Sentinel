// GitHub repo row -> taste item: owner, language, topic keywords from name/description.
import { itemFeatures } from "../../core/taste/features.ts";
import type { TasteItem } from "../../core/taste/model.ts";
import { repoView } from "./panelLogic.ts";

export function repoTaste(r: Record<string, unknown>): TasteItem {
  const v = repoView(r);
  return {
    key: `gh:${v.name}`,
    features: itemFeatures({ repo: v.name.includes("/") ? v.name.split("/")[0] : null, category: v.language, text: `${v.name.replace(/[/_.-]/g, " ")} ${v.description ?? ""}` }),
  };
}
