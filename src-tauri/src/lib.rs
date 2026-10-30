mod bot;
mod commands;
mod desktop;
mod migrations;
mod gamemode;
mod panels;
use commands::*;
use panels::manager::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(std::sync::Mutex::new(panels::state::Panels::new()))
        .manage(Specs::default())
        .manage(Mcp::default())
        .manage(bot::BotBrowser::default())
        .manage(gamemode::GameMode::default())
        .manage(desktop::hotkeys::Hotkeys::default())
        .setup(|app| {
            gamemode::start_poll(app.handle().clone());
            if let Err(e) = desktop::tray::create(app.handle()) {
                eprintln!("tray icon unavailable: {e}");
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(desktop::hotkeys::plugin())
        // Start with Windows: registered only when the user enables it in Settings (off by default).
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:sentinel.db", migrations::all())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_pc_metrics,
            get_network_devices,
            clone_repo,
            project_info,
            open_cloned,
            delete_cloned_dir,
            oauth_listen_once,
            oauth_http,
            oauth_cancel,
            ollama_request,
            coach_aoc::coach_aoc_fetch,
            coach_run::coach_run_code,
            ollama_installed,
            mail_list_folders,
            mail_fetch_headers,
            mail_fetch_message,
            mail_set_flag,
            mail_move,
            mail_delete,
            mail_send,
            mail_fetch_attachment,
            mail_save_attachment,
            mail_append_draft,
            backup_database,
            delete_backup,
            restore_database,
            tcp_port_scan,
            tcp_banner_grab,
            dns_lookup,
            web_check,
            write_text_file,
            preview_temp_cleanup,
            apply_temp_cleanup,
            scan_folder,
            hash_file,
            find_duplicates,
            trash_files,
            kill_process,
            list_processes,
            list_sensors,
            power_plans,
            set_power_plan,
            list_startup,
            set_startup_enabled,
            pending_updates,
            permission_audit,
            wifi_report,
            listening_ports,
            apply_moves,
            list_dir_files,
            browser_caches,
            clear_browser_cache,
            default_gateway,
            ping_hosts,
            wake_on_lan,
            git_status,
            scan_secrets,
            game_manifests,
            steam_app_manifests,
            read_image_data,
            now_playing,
            search_files,
            set_credential,
            get_credential,
            delete_credential,
            skills_write,
            skills_remove,
            skills_read_file,
            mcp_start,
            mcp_stop,
            mcp_running,
            mcp_tools,
            mcp_call,
            open_panel,
            close_panel,
            move_panel,
            resize_panel,
            focus_panel,
            panels::embed::embed_show,
            panels::embed::embed_hide,
            panels::browser::browser_show,
            panels::browser::browser_hide,
            panels::browser::browser_go,
            panels::browser::browser_close_tab,
            panels::browser_os::opera_bookmarks,
            panels::browser_os::open_in_opera,
            panels::browser_os::browser_open_downloads,
            get_panel,
            toggle_full_window,
            restore_layout,
            bot::bot_open,
            bot::bot_navigate,
            bot::bot_run,
            bot::bot_show,
            bot::bot_close,
            gamemode::set_game_mode,
            gamemode::set_game_mode_auto,
            desktop::tray::set_tray_unread,
            desktop::hotkeys::set_hotkeys,
            desktop::io::read_text_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                commands::mcp::stop_all(app);
                bot::stop(app, "app exit");
            }
        });
}
