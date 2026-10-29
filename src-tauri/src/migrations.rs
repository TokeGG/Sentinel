use tauri_plugin_sql::{Migration, MigrationKind};

// Foundation schema: module-agnostic activity log + the Notes module's own table.
// Each module adds its own numbered SQL file under src-tauri/migrations/ and one
// entry here. Versions MUST stay strictly ascending and equal to position.
pub fn all() -> Vec<Migration> {
    vec![
        Migration { version: 1, description: "activity_log + notes", sql: include_str!("../migrations/01_foundation.sql"), kind: MigrationKind::Up },
        Migration { version: 2, description: "news sources + items", sql: include_str!("../migrations/02_news.sql"), kind: MigrationKind::Up },
        Migration { version: 3, description: "weather locations", sql: include_str!("../migrations/03_weather.sql"), kind: MigrationKind::Up },
        Migration { version: 4, description: "network devices", sql: include_str!("../migrations/04_network_devices.sql"), kind: MigrationKind::Up },
        Migration { version: 5, description: "cloned repos log", sql: include_str!("../migrations/05_cloned_repos.sql"), kind: MigrationKind::Up },
        Migration { version: 6, description: "youtube subscriptions", sql: include_str!("../migrations/06_youtube_subscriptions.sql"), kind: MigrationKind::Up },
        Migration { version: 7, description: "finance watchlist", sql: include_str!("../migrations/07_finance_watchlist.sql"), kind: MigrationKind::Up },
        Migration { version: 8, description: "deals sources + offers", sql: include_str!("../migrations/08_deals.sql"), kind: MigrationKind::Up },
        Migration { version: 9, description: "congress trades", sql: include_str!("../migrations/09_congress_trades.sql"), kind: MigrationKind::Up },
        Migration { version: 10, description: "email inbox cache", sql: include_str!("../migrations/10_email_inbox.sql"), kind: MigrationKind::Up },
        Migration { version: 11, description: "social posts (multi-platform)", sql: include_str!("../migrations/11_social_posts.sql"), kind: MigrationKind::Up },
        Migration { version: 12, description: "schedule settings", sql: include_str!("../migrations/12_schedule_settings.sql"), kind: MigrationKind::Up },
        Migration { version: 13, description: "pentest engagements + scan log", sql: include_str!("../migrations/13_pentest.sql"), kind: MigrationKind::Up },
        Migration { version: 14, description: "youtube videos", sql: include_str!("../migrations/14_youtube_videos.sql"), kind: MigrationKind::Up },
        Migration { version: 15, description: "clipboard history + quick launch", sql: include_str!("../migrations/15_clipboard_quicklaunch.sql"), kind: MigrationKind::Up },
        Migration { version: 16, description: "file search roots", sql: include_str!("../migrations/16_search_roots.sql"), kind: MigrationKind::Up },
        Migration { version: 17, description: "panel layout", sql: include_str!("../migrations/17_panel_layout.sql"), kind: MigrationKind::Up },
        Migration { version: 18, description: "app settings (game_mode_auto)", sql: include_str!("../migrations/18_game_mode_auto.sql"), kind: MigrationKind::Up },
        Migration { version: 19, description: "panel prefs", sql: include_str!("../migrations/19_panel_prefs.sql"), kind: MigrationKind::Up },
        Migration { version: 20, description: "youtube channels", sql: include_str!("../migrations/20_youtube_channels.sql"), kind: MigrationKind::Up },
        Migration { version: 21, description: "youtube watched", sql: include_str!("../migrations/21_youtube_watched.sql"), kind: MigrationKind::Up },
        Migration { version: 22, description: "chat rooms", sql: include_str!("../migrations/22_chat_rooms.sql"), kind: MigrationKind::Up },
        Migration { version: 23, description: "social feed", sql: include_str!("../migrations/23_social_feed.sql"), kind: MigrationKind::Up },
        Migration { version: 24, description: "mail accounts and cache", sql: include_str!("../migrations/24_mail.sql"), kind: MigrationKind::Up },
        Migration { version: 25, description: "pentest workspace", sql: include_str!("../migrations/25_pentest_workspace.sql"), kind: MigrationKind::Up },
        Migration { version: 26, description: "social post meta", sql: include_str!("../migrations/26_social_post_meta.sql"), kind: MigrationKind::Up },
        Migration { version: 27, description: "skills and mcp servers", sql: include_str!("../migrations/27_skills_mcp.sql"), kind: MigrationKind::Up },
        Migration { version: 28, description: "browser bot notes, episodes, brain", sql: include_str!("../migrations/28_bot.sql"), kind: MigrationKind::Up },
        Migration { version: 29, description: "cloned projects", sql: include_str!("../migrations/29_cloned_projects.sql"), kind: MigrationKind::Up },
        Migration { version: 30, description: "youtube seen, watch later, signals", sql: include_str!("../migrations/30_youtube_library.sql"), kind: MigrationKind::Up },
        Migration { version: 31, description: "congress bills, votes, members, follows", sql: include_str!("../migrations/31_congress.sql"), kind: MigrationKind::Up },
        Migration { version: 32, description: "calendar events and tasks", sql: include_str!("../migrations/32_calendar_items.sql"), kind: MigrationKind::Up },
        Migration { version: 33, description: "notification log", sql: include_str!("../migrations/33_notif_log.sql"), kind: MigrationKind::Up },
        Migration { version: 34, description: "pentest lab tables + network device meta", sql: include_str!("../migrations/34_pentest_lab.sql"), kind: MigrationKind::Up },
        Migration { version: 35, description: "taste events and profiles, deal source meta", sql: include_str!("../migrations/35_taste.sql"), kind: MigrationKind::Up },
        Migration { version: 36, description: "connected accounts metadata", sql: include_str!("../migrations/36_accounts.sql"), kind: MigrationKind::Up },
        Migration { version: 37, description: "notes extras, calendar tabs, clipboard pins", sql: include_str!("../migrations/37_productivity.sql"), kind: MigrationKind::Up },
        Migration { version: 38, description: "mail/youtube/chat/social extras", sql: include_str!("../migrations/38_media_extras.sql"), kind: MigrationKind::Up },
        Migration { version: 39, description: "news/deals/finance/congress extras", sql: include_str!("../migrations/39_feeds_finance.sql"), kind: MigrationKind::Up },
        Migration { version: 40, description: "pc speed tests, net device icons, uptime, events", sql: include_str!("../migrations/40_pc_net_dev.sql"), kind: MigrationKind::Up },
        Migration { version: 41, description: "bot workflows, jobs, site notes", sql: include_str!("../migrations/41_bot_extras.sql"), kind: MigrationKind::Up },
        Migration { version: 42, description: "games library, game news, show tracker", sql: include_str!("../migrations/42_games_media.sql"), kind: MigrationKind::Up },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_are_ascending_and_match_position() {
        let m = all();
        assert_eq!(m.len(), 42);
        for (i, mig) in m.iter().enumerate() {
            assert_eq!(mig.version, (i as i64) + 1);
        }
    }
}
