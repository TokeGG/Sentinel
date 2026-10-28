
                CREATE TABLE youtube_videos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel_id TEXT NOT NULL,
                    video_id TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    published_at TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            