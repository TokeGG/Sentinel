// Congress bill/member -> taste item (sponsor, status, party, state, title keywords).
import { itemFeatures } from "../../core/taste/features.ts";
import type { TasteItem } from "../../core/taste/model.ts";
import type { BillRow, MemberRow } from "./panelLogic.ts";

export const billTaste = (b: Pick<BillRow, "ref" | "sponsor" | "status" | "title">): TasteItem => ({
  key: `bill:${b.ref}`,
  features: itemFeatures({ sender: b.sponsor, category: b.status, text: b.title }),
});

export const memberTaste = (m: Pick<MemberRow, "ref" | "name" | "party" | "state" | "chamber">): TasteItem => ({
  key: `member:${m.ref}`,
  features: itemFeatures({ sender: m.name, category: m.party, extra: m.state ? [`tag:${m.state.toLowerCase()}`] : [], source: m.chamber }),
});
