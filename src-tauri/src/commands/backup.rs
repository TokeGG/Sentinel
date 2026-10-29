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


/// Only folders this app created (`sentinel-backup-<epoch>`) may be deleted.
fn is_backup_dir_name(name: &str) -> bool {
    name.strip_prefix("sentinel-backup-")
        .map_or(false, |n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()))
}

/// Deletes a snapshot: its database files, then the folder only if now empty.
#[tauri::command]
pub fn delete_backup(backup_dir: String) -> Result<(), String> {
    let dir = std::path::Path::new(&backup_dir);
    let name = dir.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if !is_backup_dir_name(name) {
        return Err("not a Sentinel backup folder".into());
    }
    for f in db_file_names() {
        let p = dir.join(f);
        if p.exists() {
            std::fs::remove_file(&p).map_err(|e| e.to_string())?;
        }
    }
    let _ = std::fs::remove_dir(dir); // keeps the folder if it holds other files
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_backup_dir_name;

    #[test]
    fn only_app_made_backup_folders_are_deletable() {
        assert!(is_backup_dir_name("sentinel-backup-1730000000"));
        for bad in ["", "sentinel-backup-", "sentinel-backup-12x", "Documents", "sentinel-backup-1/..", "x-sentinel-backup-1"] {
            assert!(!is_backup_dir_name(bad), "{bad}");
        }
    }
}
