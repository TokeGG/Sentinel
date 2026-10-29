// Browser cache cleaner: cache folders of known browsers only (by id, never a path from the UI).
// Sizes are read-only; clearing deletes the contents of that browser's cache folders after the panel's confirm.
use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct CacheInfo { id: String, browser: String, paths: Vec<String>, bytes: u64 }

/// (id, label, cache dirs relative to LOCALAPPDATA). Firefox profiles are discovered below.
const KNOWN: [(&str, &str, &[&str]); 3] = [
    ("chrome", "Chrome", &[r"Google\Chrome\User Data\Default\Cache", r"Google\Chrome\User Data\Default\Code Cache"]),
    ("edge", "Edge", &[r"Microsoft\Edge\User Data\Default\Cache", r"Microsoft\Edge\User Data\Default\Code Cache"]),
    ("brave", "Brave", &[r"BraveSoftware\Brave-Browser\User Data\Default\Cache", r"BraveSoftware\Brave-Browser\User Data\Default\Code Cache"]),
];

fn dirs_for(id: &str) -> Vec<PathBuf> {
    let Some(local) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from) else { return vec![] };
    if id == "firefox" {
        let root = local.join(r"Mozilla\Firefox\Profiles");
        return std::fs::read_dir(root).map(|rd| rd.flatten().map(|e| e.path().join("cache2")).filter(|p| p.is_dir()).collect()).unwrap_or_default();
    }
    KNOWN.iter().find(|k| k.0 == id).map(|k| k.2.iter().map(|r| local.join(r)).filter(|p| p.is_dir()).collect()).unwrap_or_default()
}

fn size_of(p: &PathBuf) -> u64 {
    let mut t = 0;
    super::pc_walk::walk(p, 500_000, &mut |_, s| t += s);
    t
}

#[tauri::command]
pub async fn browser_caches() -> Result<Vec<CacheInfo>, String> {
    super::pc_cmd::blocking(|| {
        let ids = KNOWN.iter().map(|k| (k.0, k.1)).chain([("firefox", "Firefox")]);
        Ok(ids.filter_map(|(id, label)| {
            let d = dirs_for(id);
            if d.is_empty() { return None }
            Some(CacheInfo { id: id.into(), browser: label.into(), bytes: d.iter().map(size_of).sum(), paths: d.iter().map(|p| p.to_string_lossy().into_owned()).collect() })
        }).collect())
    }).await
}

/// Deletes the entries inside that browser's cache folders (not the folders). Locked files are skipped.
#[tauri::command]
pub async fn clear_browser_cache(id: String) -> Result<(u32, u32), String> {
    super::pc_cmd::blocking(move || {
        let dirs = dirs_for(&id);
        if dirs.is_empty() { return Err("no cache folder for that browser".into()) }
        let (mut ok, mut failed) = (0, 0);
        for d in dirs {
            for e in std::fs::read_dir(d).map_err(|e| e.to_string())?.flatten() {
                let p = e.path();
                let r = if e.file_type().map(|t| t.is_dir()).unwrap_or(false) { std::fs::remove_dir_all(&p) } else { std::fs::remove_file(&p) };
                if r.is_ok() { ok += 1 } else { failed += 1 }
            }
        }
        Ok((ok, failed))
    }).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unknown_browser_has_no_dirs() {
        assert!(dirs_for("../../etc").is_empty());
        assert!(KNOWN.iter().all(|k| k.2.iter().all(|p| p.ends_with("Cache"))));
    }
}
