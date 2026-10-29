import type { ModuleManifest } from "../../core/module";
import { congressSections } from "./panelLogic";
import { clearCache, follow, loadRows, markSeen, unfollow, unseenCount } from "./store";
import { syncCongress } from "./sync";
import { setSeat } from "./repStore";

const str = (v: unknown) => String(v ?? "").trim();

function target(args?: Record<string, unknown>) {
  const kind = str(args?.kind);
  const ref = str(args?.ref);
  if ((kind !== "bill" && kind !== "member") || !ref) throw new Error("kind (bill|member) and ref are required");
  return { kind, ref };
}

export const congressModule: ModuleManifest = {
  id: "hub.congress",
  name: "Congress",
  accent: "#d8d2c4",
  ring: "daily",
  icon: "congress",
  description:
    "News > Congress tab: recent bills with a status timeline, roll-call votes and current members, from the free GovTrack API (no key). Syncs only when you press Sync; follow bills to get a moon when their status changes.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: congressSections, options: [{ key: "taste", label: "For you ordering", type: "toggle", default: true }] },
  // Followed bills whose status changed since you last looked (counts only).
  badge: unseenCount,
  skills: [
    { name: "sync_congress", run: syncCongress },
    { name: "follow", run: async (a) => { const t = target(a); await follow(t.kind, t.ref, str(a?.label) || t.ref); return { ok: true }; } },
    { name: "unfollow", run: async (a) => { const t = target(a); await unfollow(t.kind, t.ref); return { ok: true }; } },
    { name: "mark_seen", run: async (a) => { await markSeen(str(a?.ref) || null); return { ok: true }; } },
    { name: "set_seat", run: setSeat },
    { name: "clear_cache", run: async () => { await clearCache(); return { ok: true }; } },
  ],
  load: loadRows,
  actions: [{ label: "Sync Congress", skill: "sync_congress" }],
  // Off until the user ticks "Auto-refresh" (scheduler persists the choice).
  schedule: { skill: "sync_congress", intervalMinutes: 360 },
};

// Not registered as its own planet any more: Congress lives in the News panel's "Congress" tab
// (news/CongressTab.tsx); News carries its moon and sync skills.
