// SQLite side of the feed: upsert + per-platform cap, last-visit marker, badge.
import { getDb } from "../../core/db";
import { KEEP_PER_PLATFORM } from "./panelLogic";
import type { SocialPost } from "./connectors";
import type { FeedPost } from "./panelLogic";

const VISIT_KEY = "social_last_visit"; // app_settings: ISO time the panel was last opened

type Db = Awaited<ReturnType<typeof getDb>>;
const putMeta = (d: Db, platform: string, postId: string, meta: object) =>
  d.execute(
    "INSERT INTO social_post_meta (platform, post_id, meta) VALUES ($1,$2,$3) ON CONFLICT(platform, post_id) DO UPDATE SET meta = $3",
    [platform, postId, JSON.stringify(meta)]
  );

/** Persist the outcome of a like/boost/reply (counts + action state) so a reload keeps it. */
export async function saveAction(p: FeedPost): Promise<void> {
  const d = await getDb();
  await d.execute(
    "UPDATE social_feed SET likes = $3, reposts = $4, replies = $5 WHERE platform = $1 AND post_id = $2",
    [p.platform, p.postId, p.likes, p.reposts, p.replies]
  );
  await putMeta(d, p.platform, p.postId, p.meta);
}

export async function savePosts(platform: string, posts: SocialPost[]): Promise<number> {
  const d = await getDb();
  const count = async () =>
    Number((await d.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM social_feed WHERE platform = $1", [platform]))[0]?.n ?? 0);
  const before = await count();
  for (const p of posts) {
    await d.execute(
      `INSERT INTO social_feed (platform, post_id, name, handle, avatar, text, link, media, likes, reposts, replies, posted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT(platform, post_id) DO UPDATE SET likes = $9, reposts = $10, replies = $11`,
      [platform, p.postId, p.name, p.handle, p.avatar, p.text, p.link, JSON.stringify(p.media), p.likes, p.reposts, p.replies, p.postedAt]
    );
    if (p.meta) await putMeta(d, platform, p.postId, p.meta);
  }
  await d.execute(
    `DELETE FROM social_feed WHERE platform = $1 AND id NOT IN
       (SELECT id FROM social_feed WHERE platform = $1 ORDER BY COALESCE(posted_at, fetched_at) DESC LIMIT ${KEEP_PER_PLATFORM})`,
    [platform]
  );
  await d.execute(
    "DELETE FROM social_post_meta WHERE platform = $1 AND post_id NOT IN (SELECT post_id FROM social_feed WHERE platform = $1)",
    [platform]
  );
  return Math.max(0, (await count()) - before); // new rows (before the cap trims old ones)
}

export async function loadFeed(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  return d.select<Record<string, unknown>[]>(
    `SELECT f.*, m.meta FROM social_feed f
       LEFT JOIN social_post_meta m ON m.platform = f.platform AND m.post_id = f.post_id
      ORDER BY COALESCE(f.posted_at, f.fetched_at) DESC LIMIT 2500`
  );
}

export async function getLastVisit(): Promise<string | null> {
  const d = await getDb();
  const r = await d.select<{ value: string }[]>("SELECT value FROM app_settings WHERE key = $1", [VISIT_KEY]);
  return r[0]?.value ?? null;
}

export async function markVisited(): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
    [VISIT_KEY, new Date().toISOString()]
  );
}

/** Planet badge: posts newer than the last visit (count only, never text). */
export async function newPostCount(): Promise<number> {
  const lastVisit = await getLastVisit();
  if (!lastVisit) return 0;
  const d = await getDb();
  const r = await d.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM social_feed WHERE posted_at > $1", [lastVisit]);
  return Number(r[0]?.n ?? 0); // posted_at is stored as ISO (UTC), so string order is time order
}
