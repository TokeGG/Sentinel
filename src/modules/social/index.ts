import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest, type ActionDef, type SkillDef } from "../../core/module";
import { connectors } from "./connectors";

interface PostRow extends Record<string, unknown> {
  id: number;
  platform: string;
  author: string;
  text: string;
  link: string | null;
  posted_at: string | null;
}

async function fetchAllFeeds() {
  const d = await getDb();
  let totalNew = 0;
  const errors: string[] = [];

  for (const connector of connectors) {
    try {
      const posts = await connector.fetchFeed();
      for (const p of posts) {
        const result = await d.execute(
          `INSERT OR IGNORE INTO social_posts (platform, post_id, author, text, link, posted_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [connector.id, p.postId, p.author, p.text, p.link, p.postedAt]
        );
        if (result.rowsAffected > 0) totalNew++;
      }
    } catch (e) {
      // Not connected yet is expected for most platforms most of the time —
      // still recorded, but doesn't block the other connectors.
      errors.push(`${connector.label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await logActivity(
    "social",
    "fetch_all_feeds",
    `checked ${connectors.length} connector(s)`,
    `${totalNew} new post(s)${errors.length ? `; ${errors.join("; ")}` : ""}`
  );
  return { ok: true, totalNew, errors };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const rows = await d.select<PostRow[]>(
    "SELECT * FROM social_posts ORDER BY COALESCE(posted_at, fetched_at) DESC LIMIT 100"
  );
  return rows.map((r) => ({
    id: r.id,
    title: `[${r.platform}] ${r.author}: ${r.text.slice(0, 140)}`,
    link: r.link ?? undefined,
  }));
}

// oauth connectors get a one-click "Connect <Platform>" skill/action, wired
// straight to their `connect()`. manual connectors (Bluesky, X) just need
// their credential fields filled in — no separate connect step beyond that.
const connectSkills: SkillDef[] = connectors
  .filter((c) => c.authType === "oauth" && c.connect)
  .map((c) => ({ name: `connect_${c.id}`, run: () => c.connect!() }));

const connectActions: ActionDef[] = connectors
  .filter((c) => c.authType === "oauth")
  .map((c) => ({ label: `Connect ${c.label}`, skill: `connect_${c.id}` }));

// Credential fields shown in the panel: oauth connectors only show their
// prerequisite (instance URL / client ID), not a token — the token is
// written straight to the keychain by `connect()` and never typed by hand.
const credentialFields = connectors.flatMap((c) =>
  c.credentials.map((f) => ({ key: `${c.id}_${f.key}`, label: `${c.label}: ${f.label}` }))
);

export const socialModule: ModuleManifest = {
  id: "hub.social",
  name: "Social Media",
  accent: "#ff7ab8",
  ring: "daily",
  icon: "social",
  description:
    'Multi-platform feed. Mastodon/Reddit: fill the one prerequisite field, click "Connect" — real OAuth, no password stored. Bluesky: handle + app password (no public OAuth exists yet for desktop apps). X not built yet (API is paywalled).',
  panel: "list",
  skills: [{ name: "fetch_all_feeds", run: fetchAllFeeds }, ...connectSkills],
  load: loadRows,
  actions: [{ label: "Fetch all feeds", skill: "fetch_all_feeds" }, ...connectActions],
  credentialFields,
};

registerModule(socialModule);
