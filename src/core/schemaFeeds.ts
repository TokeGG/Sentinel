// Bootstrap mirror of src-tauri/migrations/39_feeds_finance.sql (see schema.ts).
export const FEEDS_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS news_topics (
    term TEXT PRIMARY KEY,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS news_source_meta (
    source_id INTEGER PRIMARY KEY,
    tag TEXT NOT NULL DEFAULT '',
    reliability TEXT NOT NULL DEFAULT ''
)`,
  `CREATE TABLE IF NOT EXISTS news_saved (
    item_id INTEGER PRIMARY KEY,
    later INTEGER NOT NULL DEFAULT 1,
    highlight TEXT NOT NULL DEFAULT '',
    saved_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS news_enclosures (
    source_id INTEGER NOT NULL,
    guid TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (source_id, guid)
)`,
  `CREATE TABLE IF NOT EXISTS deal_prices (
    deal_key TEXT NOT NULL,
    price REAL NOT NULL,
    seen_on TEXT NOT NULL,
    PRIMARY KEY (deal_key, seen_on)
)`,
  `CREATE TABLE IF NOT EXISTS deal_wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    max_price REAL
)`,
  `CREATE TABLE IF NOT EXISTS deal_wish_hits (
    wish_id INTEGER NOT NULL,
    offer_id INTEGER NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (wish_id, offer_id)
)`,
  `CREATE TABLE IF NOT EXISTS deal_coupons (
    code TEXT NOT NULL,
    store TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    expires TEXT NOT NULL DEFAULT '',
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (code, store)
)`,
  `CREATE TABLE IF NOT EXISTS fin_groups (
    watch_id INTEGER PRIMARY KEY,
    grp TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS fin_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watch_id INTEGER NOT NULL,
    dir TEXT NOT NULL,
    price REAL NOT NULL,
    fired INTEGER NOT NULL DEFAULT 0,
    seen INTEGER NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS fin_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    watch_id INTEGER NOT NULL,
    qty REAL NOT NULL,
    cost REAL NOT NULL,
    bought_on TEXT NOT NULL DEFAULT ''
)`,
  `CREATE TABLE IF NOT EXISTS fin_budgets (
    category TEXT PRIMARY KEY,
    monthly REAL NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS fin_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    due_on TEXT NOT NULL,
    cycle TEXT NOT NULL DEFAULT 'monthly'
)`,
  `CREATE TABLE IF NOT EXISTS fin_vault (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    file_name TEXT NOT NULL DEFAULT '',
    data_url TEXT NOT NULL DEFAULT '',
    expires_on TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT ''
)`,
  `CREATE TABLE IF NOT EXISTS congress_bill_snap (
    id TEXT PRIMARY KEY,
    prev TEXT NOT NULL DEFAULT '{}',
    cur TEXT NOT NULL DEFAULT '{}'
)`,
  `CREATE TABLE IF NOT EXISTS congress_rep_votes (
    member_id TEXT NOT NULL,
    vote_id TEXT NOT NULL,
    position TEXT NOT NULL DEFAULT '',
    question TEXT NOT NULL DEFAULT '',
    voted_at TEXT,
    link TEXT,
    PRIMARY KEY (member_id, vote_id)
)`,
];
