// Bootstrap mirror of src-tauri/migrations/35_network_device_meta.sql (see schema.ts).
export const NETMETA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS network_device_meta (
    mac TEXT PRIMARY KEY,
    hostname TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    first_seen TEXT NOT NULL DEFAULT (datetime('now'))
)`,
];
