mod bot;
mod commands;
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
        .setup(|app| {
            gamemode::start_poll(app.handle().clone());
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:sentinel.db", migrations::all())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_pc_metrics,
            get_network_devices,
            clone_repo,
            oauth_listen_once,
            mail_list_folders,
            mail_fetch_headers,
            mail_fetch_message,
            mail_set_flag,
            mail_move,
            mail_delete,
            mail_send,
            backup_database,
            restore_database,
            tcp_port_scan,
            write_text_file,
            preview_temp_cleanup,
            apply_temp_cleanup,
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
            get_panel,
            toggle_full_window,
            restore_layout,
            bot::bot_open,
            bot::bot_navigate,
            bot::bot_run,
            bot::bot_show,
            bot::bot_close,
            gamemode::set_game_mode,
            gamemode::set_game_mode_auto
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
