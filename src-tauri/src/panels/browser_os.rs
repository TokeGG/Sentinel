//! OS side of the in-app browser: download file naming, the Downloads folder,
//! Opera bookmarks (read-only) and "Open in Opera" (falls back to the system browser).
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const MAX_BOOKMARKS: u64 = 20 * 1024 * 1024;

/// Safe file name: the suggested name, else the URL path's last segment, else "download".
pub fn download_name(url_path: &str, suggested: Option<&str>) -> String {
    let raw = suggested.filter(|s| !s.is_empty()).unwrap_or_else(|| url_path.rsplit('/').next().unwrap_or(""));
    let clean: String = raw.chars().map(|c| if c.is_control() || r#"<>:"/\|?*"#.contains(c) { '_' } else { c }).collect();
    let clean = clean.trim().trim_matches('.').to_string();
    if clean.is_empty() { "download".into() } else { clean.chars().take(120).collect() }
}
/// `dir/name`, or `dir/name (n).ext` if taken.
pub fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let p = dir.join(name);
    if !p.exists() {
        return p;
    }
    let (stem, ext) = match name.rsplit_once('.') { Some((s, x)) if !s.is_empty() => (s, format!(".{x}")), _ => (name, String::new()) };
    (1..10_000).map(|n| dir.join(format!("{stem} ({n}){ext}"))).find(|p| !p.exists()).unwrap_or(p)
}
/// Opera / Opera GX Bookmarks files under a roaming app-data dir.
pub fn opera_paths(appdata: &Path) -> Vec<(&'static str, PathBuf)> {
    vec![
        ("Opera", appdata.join("Opera Software").join("Opera Stable").join("Bookmarks")),
        ("Opera GX", appdata.join("Opera Software").join("Opera GX Stable").join("Bookmarks")),
    ]
}

/// Read Opera's Bookmarks JSON files (read-only, size-capped). Empty list if none found.
#[tauri::command]
pub async fn opera_bookmarks() -> Result<Vec<(String, String)>, String> {
    let Some(appdata) = std::env::var_os("APPDATA").map(PathBuf::from) else { return Ok(vec![]) };
    let mut out = vec![];
    for (name, p) in opera_paths(&appdata) {
        let Ok(meta) = std::fs::metadata(&p) else { continue };
        if meta.len() > MAX_BOOKMARKS { continue }
        if let Ok(s) = std::fs::read_to_string(&p) { out.push((name.to_string(), s)) }
    }
    Ok(out)
}

/// Open an http(s) URL in Opera (or Opera GX) if installed, else the system browser.
#[tauri::command]
pub async fn open_in_opera(app: AppHandle, url: String) -> Result<String, String> {
    let u = super::ids::parse_web_url(&url)?;
    if let Some(local) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from) {
        for sub in ["Opera", "Opera GX"] {
            let exe = local.join("Programs").join(sub).join("launcher.exe");
            if exe.is_file() && std::process::Command::new(&exe).arg(u.as_str()).spawn().is_ok() {
                return Ok(sub.into());
            }
        }
    }
    app.opener().open_url(u.as_str(), None::<&str>).map_err(|e| e.to_string())?;
    Ok("system".into())
}

/// Open the Downloads folder (or reveal one downloaded file inside it).
#[tauri::command]
pub async fn browser_open_downloads(app: AppHandle, path: Option<String>) -> Result<(), String> {
    use tauri::Manager;
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    match path.map(PathBuf::from).filter(|p| p.starts_with(&dir) && p.exists()) {
        Some(p) => app.opener().reveal_item_in_dir(p).map_err(|e| e.to_string()),
        None => app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn names_are_sanitised() {
        assert_eq!(download_name("/a/b/file.zip", None), "file.zip");
        assert_eq!(download_name("/", None), "download");
        assert_eq!(download_name("/x", Some("..\\evil:name?.exe")), "_evil_name_.exe");
        assert_eq!(download_name("/x", Some("../../etc")), "_.._etc");
    }
    #[test]
    fn unique_paths_number_duplicates() {
        let d = std::env::temp_dir().join(format!("sentinel-dl-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("a.txt"), "x").unwrap();
        assert_eq!(unique_path(&d, "a.txt"), d.join("a (1).txt"));
        assert_eq!(unique_path(&d, "b.txt"), d.join("b.txt"));
        let _ = std::fs::remove_dir_all(&d);
    }
    #[test]
    fn opera_paths_cover_both_editions() {
        let p = opera_paths(Path::new("R"));
        assert!(p[0].1.ends_with("Opera Software/Opera Stable/Bookmarks") || p[0].1.to_string_lossy().contains("Opera Stable"));
        assert!(p[1].1.to_string_lossy().contains("Opera GX Stable"));
    }
}
