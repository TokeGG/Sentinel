// Bootstrap mirror of src-tauri/migrations/30_youtube_library.sql (see schema.ts).
export const YOUTUBE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS youtube_seen (
    video_id TEXT PRIMARY KEY,
    channel_id TEXT,
    title TEXT NOT NULL,
    first_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_at TEXT NOT NULL DEFAULT (datetime('now')),
    watch_count INTEGER NOT NULL DEFAULT 1
)`,
  `CREATE TABLE IF NOT EXISTS youtube_later (
    video_id TEXT PRIMARY KEY,
    channel_id TEXT,
    title TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS youtube_signal (
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    signal TEXT NOT NULL,
    channel_id TEXT,
    title TEXT NOT NULL DEFAULT '',
    at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (target_kind, target_id, signal)
)`,
];
