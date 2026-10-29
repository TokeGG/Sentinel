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
            imap_fetch_inbox,
            smtp_send_mail,
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
            open_panel,
            close_panel,
            move_panel,
            resize_panel,
            focus_panel,
            get_panel,
            toggle_full_window,
            restore_layout,
            gamemode::set_game_mode,
            gamemode::set_game_mode_auto
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
