// Backup & Snapshot: copies the live sentinel.db (plus its WAL/SHM sidecar
// files, if SQLite is mid-write-ahead-log) to a folder you pick. Restore is
// the reverse, explicit and user-triggered only — never automatic.
fn db_file_names() -> [&'static str; 3] {
    ["sentinel.db", "sentinel.db-wal", "sentinel.db-shm"]
}

#[tauri::command]
pub fn backup_database(app: tauri::AppHandle, dest_dir: String) -> Result<String, String> {
    use tauri::Manager;
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let backup_dir = std::path::Path::new(&dest_dir).join(format!("sentinel-backup-{stamp}"));
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let mut copied = 0;
    for name in db_file_names() {
        let src = data_dir.join(name);
        if src.exists() {
            std::fs::copy(&src, backup_dir.join(name)).map_err(|e| e.to_string())?;
            copied += 1;
        }
    }
    if copied == 0 {
        return Err("no database file found to back up".into());
    }
    Ok(backup_dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn restore_database(app: tauri::AppHandle, backup_dir: String) -> Result<(), String> {
    use tauri::Manager;
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup = std::path::Path::new(&backup_dir);

    let mut restored = 0;
    for name in db_file_names() {
        let src = backup.join(name);
        if src.exists() {
            std::fs::copy(&src, data_dir.join(name)).map_err(|e| e.to_string())?;
            restored += 1;
        }
    }
    if restored == 0 {
        return Err("no database file found in that backup folder".into());
    }
    Ok(())
}

