
                CREATE TABLE youtube_subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel_id TEXT NOT NULL UNIQUE,
                    channel_title TEXT NOT NULL,
                    thumbnail_url TEXT,
                    uploads_playlist_id TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            