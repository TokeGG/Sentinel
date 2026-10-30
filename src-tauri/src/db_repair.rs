// Startup repair of sqlx's migration ledger, run BEFORE the SQL plugin's first
// migrate. Root cause of "compatibility mode": v0.1.1 edited migrations 17/18
// (added IF NOT EXISTS) after v0.1.0 had applied them. sqlx stores a SHA-384
// of each applied migration and its Migrator fails the whole run with
// VersionMismatch (or VersionMissing / Dirty) on any mismatch, so no newer
// migration ever applied. Restoring the old bytes would break every DB created
// by v0.1.1+, so instead the ledger is aligned with the shipped files. All
// migrations are CREATE TABLE IF NOT EXISTS (17+) or already applied (1-16),
// so re-stamping a checksum never skips real work. Backs the db up first.
use sha2::{Digest, Sha384};
use sqlx::{sqlite::SqliteConnectOptions, ConnectOptions, Connection, Row};
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Debug, PartialEq, Clone, serde::Serialize)]
pub enum Fix {
    Checksum(i64),
    DropUnknown(i64),
    DropFailed(i64),
}

#[derive(Default, Clone, serde::Serialize)]
pub struct RepairReport {
    pub fixes: Vec<Fix>,
    pub backup: Option<String>,
    pub error: Option<String>,
}

pub struct LastRepair(pub std::sync::Mutex<RepairReport>);

pub fn checksum(sql: &str) -> Vec<u8> {
    Sha384::digest(sql.as_bytes()).to_vec()
}

/// Pure: what must change so sqlx's validation passes. `applied` = (version, checksum, success).
pub fn plan(applied: &[(i64, Vec<u8>, bool)], current: &[(i64, Vec<u8>)]) -> Vec<Fix> {
    applied
        .iter()
        .filter_map(|(v, sum, ok)| match current.iter().find(|(cv, _)| cv == v) {
            _ if !ok => Some(Fix::DropFailed(*v)),
            None => Some(Fix::DropUnknown(*v)),
            Some((_, cur)) if cur != sum => Some(Fix::Checksum(*v)),
            _ => None,
        })
        .collect()
}

fn current() -> Vec<(i64, Vec<u8>)> {
    crate::migrations::all().iter().map(|m| (m.version, checksum(m.sql))).collect()
}

pub fn db_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    Some(app.path().app_config_dir().ok()?.join("sentinel.db"))
}

async fn repair_file(path: &Path) -> Result<RepairReport, String> {
    let mut report = RepairReport::default();
    if !path.exists() {
        return Ok(report);
    }
    let opts = SqliteConnectOptions::new().filename(path).create_if_missing(false);
    let mut conn = opts.connect().await.map_err(|e| e.to_string())?;
    let has: i64 = sqlx::query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='_sqlx_migrations'")
        .fetch_one(&mut conn).await.map_err(|e| e.to_string())?.get(0);
    if has == 0 {
        return Ok(report);
    }
    let rows = sqlx::query("SELECT version, checksum, success FROM _sqlx_migrations")
        .fetch_all(&mut conn).await.map_err(|e| e.to_string())?;
    let applied: Vec<(i64, Vec<u8>, bool)> = rows.iter().map(|r| (r.get(0), r.get(1), r.get(2))).collect();
    let cur = current();
    report.fixes = plan(&applied, &cur);
    if report.fixes.is_empty() {
        return Ok(report);
    }
    conn.close().await.map_err(|e| e.to_string())?;
    report.backup = Some(backup(path)?);
    let mut conn = opts.connect().await.map_err(|e| e.to_string())?;
    let mut tx = conn.begin().await.map_err(|e| e.to_string())?;
    for f in &report.fixes {
        let q = match f {
            Fix::Checksum(v) => sqlx::query("UPDATE _sqlx_migrations SET checksum = ?1 WHERE version = ?2")
                .bind(cur.iter().find(|(cv, _)| cv == v).map(|c| c.1.clone()).unwrap_or_default()).bind(*v),
            Fix::DropUnknown(v) | Fix::DropFailed(v) => sqlx::query("DELETE FROM _sqlx_migrations WHERE version = ?1").bind(*v),
        };
        q.execute(&mut *tx).await.map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(report)
}

/// Copies the db (and -wal/-shm if present) next to itself with a timestamp.
fn backup(path: &Path) -> Result<String, String> {
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let dest = path.with_file_name(format!("sentinel.db.repair-{ts}.bak"));
    std::fs::copy(path, &dest).map_err(|e| format!("backup failed: {e}"))?;
    for ext in ["-wal", "-shm"] {
        let src = PathBuf::from(format!("{}{ext}", path.display()));
        if src.exists() {
            let _ = std::fs::copy(&src, format!("{}{ext}", dest.display()));
        }
    }
    Ok(dest.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default())
}

pub fn init(app: &tauri::AppHandle) {
    let rep = match db_path(app) {
        Some(p) => tauri::async_runtime::block_on(repair_file(&p))
            .unwrap_or_else(|e| RepairReport { error: Some(e), ..Default::default() }),
        None => RepairReport::default(),
    };
    app.manage(LastRepair(std::sync::Mutex::new(rep)));
}

/// Settings > Database check: last startup result, or run again (takes effect on restart).
#[tauri::command]
pub async fn db_repair(app: tauri::AppHandle, run: bool) -> Result<RepairReport, String> {
    if !run {
        return Ok(app.state::<LastRepair>().0.lock().map_err(|e| e.to_string())?.clone());
    }
    let path = db_path(&app).ok_or("no app config dir")?;
    let r = repair_file(&path).await?;
    *app.state::<LastRepair>().0.lock().map_err(|e| e.to_string())? = r.clone();
    Ok(r)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_flags_mismatch_unknown_and_failed() {
        let cur = vec![(1, checksum("a")), (2, checksum("b"))];
        let applied = vec![(1, checksum("a"), true), (2, checksum("old"), true), (9, checksum("x"), true), (1, checksum("a"), false)];
        assert_eq!(plan(&applied, &cur), vec![Fix::Checksum(2), Fix::DropUnknown(9), Fix::DropFailed(1)]);
        assert!(plan(&[(1, checksum("a"), true)], &cur).is_empty());
    }

    #[test]
    fn v010_files_17_18_mismatch_current() {
        // Exact v0.1.0 bytes differ only by IF NOT EXISTS; the ledger must be re-stamped.
        let old17 = include_str!("../migrations/17_panel_layout.sql").replace("CREATE TABLE IF NOT EXISTS", "CREATE TABLE");
        let cur = current();
        let applied = vec![(17, checksum(&old17), true)];
        assert_eq!(plan(&applied, &cur), vec![Fix::Checksum(17)]);
    }

    #[test]
    fn repair_file_restamps_ledger_and_backs_up() {
        let dir = std::env::temp_dir().join(format!("sentinel-repair-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("sentinel.db");
        let _ = std::fs::remove_file(&path);
        tauri::async_runtime::block_on(async {
            let mut c = SqliteConnectOptions::new().filename(&path).create_if_missing(true).connect().await.unwrap();
            sqlx::query("CREATE TABLE _sqlx_migrations (version BIGINT PRIMARY KEY, description TEXT, installed_on TEXT, success BOOLEAN, checksum BLOB, execution_time BIGINT)").execute(&mut c).await.unwrap();
            sqlx::query("INSERT INTO _sqlx_migrations VALUES (17,'x','',1,?1,0),(99,'y','',1,?1,0)").bind(checksum("old")).execute(&mut c).await.unwrap();
            c.close().await.unwrap();
            let r = repair_file(&path).await.unwrap();
            assert_eq!(r.fixes, vec![Fix::Checksum(17), Fix::DropUnknown(99)]);
            assert!(r.backup.is_some());
            assert!(repair_file(&path).await.unwrap().fixes.is_empty());
        });
        let _ = std::fs::remove_dir_all(&dir);
    }
}
