CREATE TABLE IF NOT EXISTS installed_skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    bundle TEXT NOT NULL DEFAULT '',
    repo TEXT NOT NULL,
    subdir TEXT NOT NULL DEFAULT '',
    sha TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    files TEXT NOT NULL DEFAULT '[]',
    installed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bundle TEXT NOT NULL DEFAULT '',
    repo TEXT NOT NULL,
    subdir TEXT NOT NULL DEFAULT '',
    sha TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    command TEXT NOT NULL,
    args TEXT NOT NULL DEFAULT '[]',
    env TEXT NOT NULL DEFAULT '{}',
    secret_names TEXT NOT NULL DEFAULT '[]',
    flagged TEXT NOT NULL DEFAULT '[]',
    files TEXT NOT NULL DEFAULT '[]',
    installed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
