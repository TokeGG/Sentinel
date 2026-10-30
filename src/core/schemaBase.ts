// Bootstrap mirror of migrations 01-16. Those files keep their original bytes
// (sqlx checksums applied migrations; editing one = VersionMismatch), so the
// IF NOT EXISTS lives here. ensureSchema runs these first; schema.test.ts checks them.
export const BASE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, module TEXT NOT NULL, skill TEXT NOT NULL, summary TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, tags TEXT, filed_to TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS news_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, label TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS news_items (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL REFERENCES news_sources(id), guid TEXT NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL, published_at TEXT, fetched_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (source_id, guid))`,
  `CREATE TABLE IF NOT EXISTS weather_locations (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS network_devices (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, mac TEXT NOT NULL, tag TEXT, last_seen TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (mac))`,
  `CREATE TABLE IF NOT EXISTS cloned_repos (id INTEGER PRIMARY KEY AUTOINCREMENT, repo TEXT NOT NULL, dest_dir TEXT NOT NULL, cloned_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS youtube_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT NOT NULL UNIQUE, channel_title TEXT NOT NULL, thumbnail_url TEXT, uploads_playlist_id TEXT, fetched_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS watchlist (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('stock', 'crypto')), last_price REAL, last_checked TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (symbol, kind))`,
  `CREATE TABLE IF NOT EXISTS deal_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, label TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS deal_offers (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL REFERENCES deal_sources(id), guid TEXT NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL, published_at TEXT, fetched_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (source_id, guid))`,
  `CREATE TABLE IF NOT EXISTS congress_trades (id INTEGER PRIMARY KEY AUTOINCREMENT, chamber TEXT NOT NULL CHECK (chamber IN ('senate', 'house')), politician TEXT NOT NULL, ticker TEXT, transaction_type TEXT, trade_date TEXT, amount_range TEXT, fetched_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (chamber, politician, ticker, trade_date, transaction_type, amount_range))`,
  `CREATE TABLE IF NOT EXISTS email_inbox (id INTEGER PRIMARY KEY AUTOINCREMENT, uid INTEGER NOT NULL UNIQUE, sender TEXT NOT NULL, subject TEXT NOT NULL, mail_date TEXT, fetched_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS social_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT NOT NULL, post_id TEXT NOT NULL, author TEXT NOT NULL, text TEXT NOT NULL, link TEXT, posted_at TEXT, fetched_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (platform, post_id))`,
  `CREATE TABLE IF NOT EXISTS schedule_settings (module_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS engagements (id INTEGER PRIMARY KEY AUTOINCREMENT, client_name TEXT NOT NULL, scope TEXT NOT NULL, authorization_ref TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS scan_results (id INTEGER PRIMARY KEY AUTOINCREMENT, engagement_id INTEGER NOT NULL REFERENCES engagements(id), target TEXT NOT NULL, port INTEGER NOT NULL, open INTEGER NOT NULL, scanned_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS youtube_videos (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT NOT NULL, video_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, published_at TEXT, fetched_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS clipboard_history (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, copied_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS quick_launch_items (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS search_roots (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
];
