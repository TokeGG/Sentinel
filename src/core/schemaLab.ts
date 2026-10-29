// Bootstrap mirror of src-tauri/migrations/34_pentest_lab.sql (pentest lab tables + network_device_meta) (see schema.ts).
export const LAB_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS pentest_run_args (
    run_id INTEGER PRIMARY KEY,
    args TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS pentest_checklist (
    engagement_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    done_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (engagement_id, item_id)
)`,
  `CREATE TABLE IF NOT EXISTS pentest_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finding_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS pentest_notebook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engagement_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'note',
    tags TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS pentest_remediation (
    finding_id INTEGER PRIMARY KEY,
    owner TEXT NOT NULL DEFAULT '',
    due TEXT NOT NULL DEFAULT '',
    retest_run_id INTEGER,
    retest_summary TEXT NOT NULL DEFAULT '',
    retested_at TEXT NOT NULL DEFAULT ''
)`,
  `CREATE TABLE IF NOT EXISTS pentest_cve (
    id TEXT PRIMARY KEY,
    product TEXT NOT NULL,
    affected TEXT NOT NULL,
    cvss REAL,
    summary TEXT NOT NULL DEFAULT ''
)`,
  `CREATE TABLE IF NOT EXISTS network_device_meta (
    mac TEXT PRIMARY KEY,
    hostname TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    first_seen TEXT NOT NULL DEFAULT (datetime('now'))
)`,
];
