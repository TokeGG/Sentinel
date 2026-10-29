// Read-only game library discovery: returns raw manifest text (bounded) for the TS parsers in
// src/modules/games (vdf.ts, epic.ts). Never writes, never launches; launching goes through the
// opener with steam:// / com.epicgames.launcher:// URIs (capability allow-list).
use serde::Serialize;
use std::path::{Path, PathBuf};

const MAX_FILE: u64 = 256 * 1024;
const MAX_FILES: usize = 1000;

#[derive(Serialize, Default)]
pub struct GameManifests { steam_libraries: Option<String>, epic_items: Vec<String> }

/// Reads files in `dir` whose name starts with `prefix` and ends with `ext`, each at most MAX_FILE.
pub fn read_matching(dir: &Path, prefix: &str, ext: &str) -> Vec<String> {
    let Ok(rd) = std::fs::read_dir(dir) else { return vec![] };
    rd.flatten()
        .filter(|e| { let n = e.file_name().to_string_lossy().to_lowercase(); n.starts_with(prefix) && n.ends_with(ext) })
        .filter(|e| e.metadata().map(|m| m.is_file() && m.len() <= MAX_FILE).unwrap_or(false))
        .take(MAX_FILES)
        .filter_map(|e| std::fs::read_to_string(e.path()).ok())
        .collect()
}

fn read_small(p: &Path) -> Option<String> {
    let m = std::fs::metadata(p).ok()?;
    if !m.is_file() || m.len() > MAX_FILE { return None }
    std::fs::read_to_string(p).ok()
}

#[cfg(windows)]
fn roots() -> (Vec<PathBuf>, PathBuf) {
    let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    let pd = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".into());
    (vec![PathBuf::from(pf86).join("Steam")], PathBuf::from(pd).join(r"Epic\EpicGamesLauncher\Data\Manifests"))
}
#[cfg(not(windows))]
fn roots() -> (Vec<PathBuf>, PathBuf) { (vec![], PathBuf::new()) }

/// Steam's libraryfolders.vdf + every Epic .item manifest (empty on non-Windows).
#[tauri::command]
pub async fn game_manifests() -> Result<GameManifests, String> {
    super::pc_cmd::blocking(|| {
        let (steam, epic) = roots();
        let steam_libraries = steam.iter().find_map(|s| read_small(&s.join("steamapps").join("libraryfolders.vdf")));
        let epic_items = if epic.as_os_str().is_empty() { vec![] } else { read_matching(&epic, "", ".item") };
        Ok(GameManifests { steam_libraries, epic_items })
    }).await
}

/// appmanifest_*.acf text from each library's steamapps folder (paths parsed from the vdf in TS).
#[tauri::command]
pub async fn steam_app_manifests(libraries: Vec<String>) -> Result<Vec<String>, String> {
    super::pc_cmd::blocking(move || {
        let mut out = vec![];
        for lib in libraries.iter().take(32) {
            let p = PathBuf::from(lib);
            if !p.is_absolute() { continue }
            out.extend(read_matching(&p.join("steamapps"), "appmanifest_", ".acf"));
        }
        Ok(out)
    }).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_only_matching_small_files() {
        let d = std::env::temp_dir().join(format!("sentinel-games-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("appmanifest_440.acf"), "\"AppState\"{}").unwrap();
        std::fs::write(d.join("other.acf"), "x").unwrap();
        std::fs::write(d.join("appmanifest_1.txt"), "x").unwrap();
        assert_eq!(read_matching(&d, "appmanifest_", ".acf"), vec!["\"AppState\"{}".to_string()]);
        assert!(read_matching(&d.join("missing"), "", ".item").is_empty());
        std::fs::remove_dir_all(&d).ok();
    }
}
