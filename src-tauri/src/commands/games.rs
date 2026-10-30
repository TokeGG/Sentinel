// Read-only game library discovery: returns raw manifest text and `reg query` output (bounded) for the
// TS parsers in src/modules/games (vdf.ts, epic.ts, reg.ts). Never writes, never launches; launching
// goes through the opener with store URIs (capability allow-list). Every miss is reported, not swallowed.
use serde::Serialize;
use std::path::{Path, PathBuf};

const MAX_FILE: u64 = 256 * 1024;
const MAX_FILES: usize = 1000;

#[derive(Serialize, Default)]
pub struct GameManifests {
    steam_root: Option<String>,
    steam_tried: Vec<String>,
    steam_libraries: Option<String>,
    epic_dir: String,
    epic_dir_found: bool,
    epic_items: Vec<String>,
    gog_reg: String,
    ubisoft_reg: String,
    uninstall_reg: String,
    errors: Vec<String>,
}

#[derive(Serialize)]
pub struct SteamLib { library: String, found: bool, manifests: Vec<String> }

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

/// Value of `name` (REG_SZ / REG_EXPAND_SZ) in `reg query` output, if present.
pub fn reg_value(text: &str, name: &str) -> Option<String> {
    text.lines().find_map(|l| {
        let mut it = l.trim().splitn(3, "    ");
        let (k, t, v) = (it.next()?, it.next()?.trim(), it.next()?.trim());
        (k.eq_ignore_ascii_case(name) && t.starts_with("REG_") && !v.is_empty()).then(|| v.to_string())
    })
}

#[cfg(windows)]
fn reg(args: &[&str]) -> String { super::pc_cmd::run_fixed("reg", args).unwrap_or_default() }

/// Candidate Steam roots: registry (HKCU SteamPath, HKLM InstallPath) then the default folder.
#[cfg(windows)]
fn steam_candidates() -> Vec<PathBuf> {
    let mut v = vec![];
    if let Some(p) = reg_value(&reg(&["query", r"HKCU\Software\Valve\Steam", "/v", "SteamPath"]), "SteamPath") { v.push(p) }
    for k in [r"HKLM\SOFTWARE\WOW6432Node\Valve\Steam", r"HKLM\SOFTWARE\Valve\Steam"] {
        if let Some(p) = reg_value(&reg(&["query", k, "/v", "InstallPath"]), "InstallPath") { v.push(p) }
    }
    let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    v.push(format!(r"{pf86}\Steam"));
    v.into_iter().map(|s| PathBuf::from(s.replace('/', "\\"))).collect()
}
#[cfg(windows)]
fn epic_dir() -> PathBuf {
    let pd = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".into());
    PathBuf::from(pd).join(r"Epic\EpicGamesLauncher\Data\Manifests")
}
#[cfg(windows)]
fn other_regs(m: &mut GameManifests) {
    m.gog_reg = reg(&["query", r"HKLM\SOFTWARE\WOW6432Node\GOG.com\Games", "/s"]);
    m.ubisoft_reg = reg(&["query", r"HKLM\SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs", "/s"]);
    for k in [r"HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall", r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"] {
        m.uninstall_reg.push_str(&reg(&["query", k, "/s"]));
    }
}
#[cfg(not(windows))]
fn steam_candidates() -> Vec<PathBuf> { vec![] }
#[cfg(not(windows))]
fn epic_dir() -> PathBuf { PathBuf::new() }
#[cfg(not(windows))]
fn other_regs(m: &mut GameManifests) { m.errors.push("Game libraries are read on Windows only.".into()) }

/// Steam root + libraryfolders.vdf, Epic .item manifests, raw registry text for other launchers.
#[tauri::command]
pub async fn game_manifests() -> Result<GameManifests, String> {
    super::pc_cmd::blocking(|| {
        let mut m = GameManifests::default();
        for c in steam_candidates() {
            m.steam_tried.push(c.display().to_string());
            if c.join("steamapps").is_dir() || c.join("steam.exe").is_file() {
                m.steam_libraries = read_small(&c.join("steamapps").join("libraryfolders.vdf"))
                    .or_else(|| read_small(&c.join("config").join("libraryfolders.vdf")));
                m.steam_root = Some(c.display().to_string());
                break;
            }
        }
        let e = epic_dir();
        m.epic_dir = e.display().to_string();
        m.epic_dir_found = !m.epic_dir.is_empty() && e.is_dir();
        if m.epic_dir_found { m.epic_items = read_matching(&e, "", ".item") }
        other_regs(&mut m);
        Ok(m)
    }).await
}

/// appmanifest_*.acf text from each library's steamapps folder, per library (paths parsed in TS).
#[tauri::command]
pub async fn steam_app_manifests(libraries: Vec<String>) -> Result<Vec<SteamLib>, String> {
    super::pc_cmd::blocking(move || {
        Ok(libraries.iter().take(32).filter(|l| PathBuf::from(l).is_absolute()).map(|l| {
            let d = PathBuf::from(l).join("steamapps");
            SteamLib { library: l.clone(), found: d.is_dir(), manifests: read_matching(&d, "appmanifest_", ".acf") }
        }).collect())
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
    #[test]
    fn parses_reg_query_values() {
        let t = "\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n    Language    REG_SZ    english\r\n";
        assert_eq!(reg_value(t, "SteamPath").as_deref(), Some("c:/program files (x86)/steam"));
        assert_eq!(reg_value(t, "steampath").as_deref(), Some("c:/program files (x86)/steam"));
        assert_eq!(reg_value(t, "InstallPath"), None);
        assert_eq!(reg_value("ERROR: The system was unable to find the specified registry key or value.", "SteamPath"), None);
    }
}
