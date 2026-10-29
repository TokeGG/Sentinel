// SQLite for follow lists and mutes (migration 38) + the unified inbox fetch.
import { getDb, logActivity } from "../../core/db";
import { connectors } from "./connectors";
import { mergePosts, type FeedPost } from "./panelLogic";
import { normHandle } from "./muteLists";

export interface ListRow { name: string; platform: string; handle: string }
export async function loadListsMutes(): Promise<{ lists: ListRow[]; mutes: { kind: string; value: string }[] }> {
  const d = await getDb();
  const [lists, mutes] = await Promise.all([
    d.select<ListRow[]>("SELECT * FROM social_lists ORDER BY name, platform, handle"),
    d.select<{ kind: string; value: string }[]>("SELECT * FROM social_mutes ORDER BY kind, value"),
  ]);
  return { lists, mutes };
}
export async function setListMember(name: string, platform: string, handle: string, on: boolean) {
  const d = await getDb(), h = normHandle(handle);
  if (on) await d.execute("INSERT OR IGNORE INTO social_lists (name, platform, handle) VALUES ($1,$2,$3)", [name, platform, h]);
  else await d.execute("DELETE FROM social_lists WHERE name=$1 AND platform=$2 AND handle=$3", [name, platform, h]);
}
export async function setMute(kind: "word" | "account", value: string, on: boolean) {
  const d = await getDb(), v = value.trim().toLowerCase();
  if (on) await d.execute("INSERT OR IGNORE INTO social_mutes (kind, value) VALUES ($1,$2)", [kind, v]);
  else await d.execute("DELETE FROM social_mutes WHERE kind=$1 AND value=$2", [kind, v]);
}

/** Mentions/replies from every connected platform whose API offers them (button press only). */
export async function fetchInbox(): Promise<{ posts: FeedPost[]; errors: string[] }> {
  const errors: string[] = [];
  const lists: FeedPost[][] = [];
  for (const c of connectors) {
    if (!c.fetchInbox) continue;
    try { lists.push((await c.fetchInbox()).map((p) => ({ ...p, platform: c.id, meta: p.meta ?? {} }))); }
    catch (e) { errors.push(`${c.label}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const posts = mergePosts(...lists);
  await logActivity("social", "fetch_inbox", `${lists.length} platform(s)`, `${posts.length} item(s)${errors.length ? `; ${errors.length} failed` : ""}`);
  return { posts, errors };
}
