
                CREATE TABLE social_posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    platform TEXT NOT NULL,
                    post_id TEXT NOT NULL,
                    author TEXT NOT NULL,
                    text TEXT NOT NULL,
                    link TEXT,
                    posted_at TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (platform, post_id)
                );
            