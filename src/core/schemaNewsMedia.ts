// Bootstrap mirror of src-tauri/migrations/49_news_media.sql (see schema.ts).
export const NEWS_MEDIA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS news_item_media (
    source_id INTEGER NOT NULL,
    guid TEXT NOT NULL,
    image TEXT,
    summary TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (source_id, guid)
)`,
];
