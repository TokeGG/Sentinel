
                CREATE TABLE weather_locations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    label TEXT NOT NULL,
                    lat REAL NOT NULL,
                    lon REAL NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            