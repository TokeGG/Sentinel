// SQL for the one-row-per-video history (youtube_seen). Kept as constants so
// library.test.ts can run the exact statements against an in-memory SQLite.

/** A play: insert, or bump last_at + count (first_at is kept). */
export const PLAY_SQL = `INSERT INTO youtube_seen (video_id, channel_id, title) VALUES ($1, $2, $3)
 ON CONFLICT(video_id) DO UPDATE SET last_at = datetime('now'), watch_count = watch_count + 1,
 title = excluded.title, channel_id = COALESCE(excluded.channel_id, channel_id)`;

/** Takeout import of an already-merged item. Re-importing the same file is a
 *  no-op (min first, max last, max count) and never replaces newer local plays. */
export const IMPORT_SQL = `INSERT INTO youtube_seen (video_id, channel_id, title, first_at, last_at, watch_count)
 VALUES ($1, $2, $3, COALESCE(datetime($4), datetime('now')), COALESCE(datetime($5), datetime('now')), $6)
 ON CONFLICT(video_id) DO UPDATE SET first_at = MIN(first_at, excluded.first_at), last_at = MAX(last_at, excluded.last_at),
 watch_count = MAX(watch_count, excluded.watch_count),
 title = CASE WHEN excluded.last_at > last_at THEN excluded.title ELSE title END,
 channel_id = COALESCE(channel_id, excluded.channel_id)`;

/** One-time merge of the old duplicate-prone youtube_watched rows. Idempotent. */
export const BACKFILL_SQL = `INSERT INTO youtube_seen (video_id, channel_id, title, first_at, last_at, watch_count)
 SELECT w.video_id, MAX(w.channel_id),
  (SELECT t.title FROM youtube_watched t WHERE t.video_id = w.video_id ORDER BY t.watched_at DESC, t.id DESC LIMIT 1),
  MIN(w.watched_at), MAX(w.watched_at), COUNT(*)
 FROM youtube_watched w WHERE true GROUP BY w.video_id
 ON CONFLICT(video_id) DO NOTHING`;
