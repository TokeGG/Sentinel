use tauri_plugin_sql::{Migration, MigrationKind};

// Foundation schema: module-agnostic activity log + the Notes module's own table.
// Each module adds its own numbered SQL file under src-tauri/migrations/ and one
// entry here. Versions MUST stay strictly ascending and equal to position.
pub fn all() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "activity_log + notes",
            sql: include_str!("../migrations/01_foundation.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "news sources + items",
            sql: include_str!("../migrations/02_news.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "weather locations",
            sql: include_str!("../migrations/03_weather.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "network devices",
            sql: include_str!("../migrations/04_network_devices.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "cloned repos log",
            sql: include_str!("../migrations/05_cloned_repos.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "youtube subscriptions",
            sql: include_str!("../migrations/06_youtube_subscriptions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "finance watchlist",
            sql: include_str!("../migrations/07_finance_watchlist.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "deals sources + offers",
            sql: include_str!("../migrations/08_deals.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "congress trades",
            sql: include_str!("../migrations/09_congress_trades.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "email inbox cache",
            sql: include_str!("../migrations/10_email_inbox.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "social posts (multi-platform)",
            sql: include_str!("../migrations/11_social_posts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "schedule settings",
            sql: include_str!("../migrations/12_schedule_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "pentest engagements + scan log",
            sql: include_str!("../migrations/13_pentest.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "youtube videos",
            sql: include_str!("../migrations/14_youtube_videos.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "clipboard history + quick launch",
            sql: include_str!("../migrations/15_clipboard_quicklaunch.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "file search roots",
            sql: include_str!("../migrations/16_search_roots.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "panel layout",
            sql: include_str!("../migrations/17_panel_layout.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "app settings (game_mode_auto)",
            sql: include_str!("../migrations/18_game_mode_auto.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_are_ascending_and_match_position() {
        let m = all();
        assert_eq!(m.len(), 18);
        for (i, mig) in m.iter().enumerate() {
            assert_eq!(mig.version, (i as i64) + 1);
        }
    }
}
