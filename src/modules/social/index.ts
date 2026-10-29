import { getCredential } from "../../core/credentials";
import { logActivity } from "../../core/db";
import { registerModule, type ModuleManifest, type ActionDef, type SkillDef } from "../../core/module";
import { connectors } from "./connectors";
import { socialOptions, socialSections } from "./panelLogic";
import { runAction } from "./actions";
import { loadFeed, newPostCount, savePosts } from "./store";

async function fetchAllFeeds() {
  let totalNew = 0;
  const errors: string[] = [];
  for (const c of connectors) {
    try {
      totalNew += await savePosts(c.id, await c.fetchFeed());
    } catch (e) {
      // Not connected yet is expected for most platforms most of the time —
      // recorded, but doesn't block the other connectors.
      errors.push(`${c.label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await logActivity("social", "fetch_all_feeds", `checked ${connectors.length} connector(s)`,
    `${totalNew} new post(s)${errors.length ? `; ${errors.join("; ")}` : ""}`);
  return { ok: true, totalNew, errors };
}

/** Which accounts are connected and which can publish (read by the composer/Accounts section). */
async function connectionStatus() {
  return Promise.all(
    connectors.map(async (c) => ({
      id: c.id,
      label: c.label,
      canPost: !!c.post,
      can: { like: !!c.like, share: !!c.share, reply: !!c.reply },
      connected: c.connectedKey ? !!(await getCredential("hub.social", `${c.id}_${c.connectedKey}`).catch(() => null)) : false,
    }))
  );
}

async function postStatus(args?: Record<string, unknown>) {
  const text = String(args?.text ?? "").trim();
  const targets = Array.isArray(args?.targets) ? (args!.targets as string[]) : [];
  if (!text) throw new Error("text is empty");
  const failed: string[] = [];
  for (const id of targets) {
    const c = connectors.find((k) => k.id === id);
    try {
      if (!c?.post) throw new Error("read-only");
      await c.post(text);
    } catch (e) {
      failed.push(`${c?.label ?? id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await logActivity("social", "post_status", `to ${targets.join(", ")}`, failed.length ? `failed: ${failed.length}` : "ok");
  if (failed.length) throw new Error(`Not posted — ${failed.join("; ")}`);
  return { ok: true };
}

// oauth connectors get a one-click "Connect <Platform>" skill/action. manual
// ones (Bluesky, X) just need their credential fields filled in.
const oauth = connectors.filter((c) => c.authType === "oauth" && c.connect);
const connectSkills: SkillDef[] = oauth.map((c) => ({ name: `connect_${c.id}`, run: () => c.connect!() }));
const connectActions: ActionDef[] = oauth.map((c) => ({ label: `Connect ${c.label}`, skill: `connect_${c.id}` }));

// Prerequisites only (instance URL / client ID / handle / app password); OAuth
// tokens are written straight to the OS keychain by `connect()`.
const credentialFields = connectors.flatMap((c) =>
  c.credentials.map((f) => ({ key: `${c.id}_${f.key}`, label: `${c.label}: ${f.label}` }))
);

export const socialModule: ModuleManifest = {
  id: "hub.social",
  name: "Social Media",
  accent: "#f57cb6",
  ring: "daily",
  icon: "social",
  description:
    "One chronological feed across Bluesky, Mastodon and Reddit; post to Bluesky and Mastodon; like, boost and reply where the platform allows. X is not built (its API is paywalled).",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: socialSections, options: socialOptions },
  badge: newPostCount,
  skills: [
    { name: "fetch_all_feeds", run: fetchAllFeeds },
    { name: "connection_status", run: connectionStatus },
    { name: "post_status", run: postStatus },
    { name: "post_action", run: (a) => runAction(a) },
    ...connectSkills,
  ],
  load: loadFeed,
  actions: [{ label: "Refresh", skill: "fetch_all_feeds" }, ...connectActions],
  credentialFields,
  schedule: { skill: "fetch_all_feeds", intervalMinutes: 15 },
};

registerModule(socialModule);
