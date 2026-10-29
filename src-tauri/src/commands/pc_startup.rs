// Startup programs: Run keys (HKCU/HKLM) + the user's Startup folder. Disable/enable writes the same
// StartupApproved flag Task Manager uses (reversible; the program entry itself is never touched).
use super::pc_cmd::run_fixed;
use serde::Serialize;

const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APPROVED: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved";
pub const ON: &str = "020000000000000000000000";
pub const OFF: &str = "030000000000000000000000";

#[derive(Serialize, Debug, PartialEq, Clone)]
pub struct Entry { id: String, source: String, name: String, command: String, enabled: bool }

/// Parses `reg query` value lines: (name, type, data).
pub fn parse_reg(text: &str) -> Vec<(String, String, String)> {
    let re = regex_lite::Regex::new(r"^\s{2,}(.+?)\s{2,}(REG_[A-Z_]+)\s*(.*)$").unwrap();
    text.lines().filter_map(|l| re.captures(l)).map(|c| (c[1].to_string(), c[2].to_string(), c[3].trim().to_string())).collect()
}

/// StartupApproved data: odd first byte = disabled; missing = enabled.
pub fn approved(data: Option<&str>) -> bool {
    data.and_then(|d| u8::from_str_radix(d.get(0..2)?, 16).ok()).map(|b| b & 1 == 0).unwrap_or(true)
}

/// (source id, hive, approved sub-key) for each source.
fn sources() -> [(&'static str, &'static str, &'static str); 3] {
    [("hkcu", "HKCU", "Run"), ("hklm", "HKLM", "Run"), ("folder", "HKCU", "StartupFolder")]
}

fn query(key: &str) -> Vec<(String, String, String)> { run_fixed("reg", &["query", key]).map(|t| parse_reg(&t)).unwrap_or_default() }

fn startup_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("APPDATA").map(|a| std::path::PathBuf::from(a).join(r"Microsoft\Windows\Start Menu\Programs\Startup"))
}

pub fn list() -> Vec<Entry> {
    let mut out = Vec::new();
    for (src, hive, sub) in sources() {
        let flags = query(&format!(r"{hive}\{APPROVED}\{sub}"));
        let flag = |n: &str| flags.iter().find(|f| f.0 == n).map(|f| f.2.clone());
        let items: Vec<(String, String)> = if src == "folder" {
            startup_dir().and_then(|d| std::fs::read_dir(d).ok()).map(|rd| rd.flatten()
                .map(|e| e.file_name().to_string_lossy().into_owned()).filter(|n| n != "desktop.ini")
                .map(|n| (n.clone(), n)).collect()).unwrap_or_default()
        } else {
            query(&format!(r"{hive}\{RUN}")).into_iter().map(|(n, _, d)| (n, d)).collect()
        };
        for (name, command) in items {
            let enabled = approved(flag(&name).as_deref());
            out.push(Entry { id: format!("{src}|{name}"), source: src.into(), name, command, enabled });
        }
    }
    out
}

#[tauri::command]
pub async fn list_startup() -> Result<Vec<Entry>, String> {
    if !cfg!(windows) { return Err("the startup manager is Windows-only".into()) }
    super::pc_cmd::blocking(|| Ok(list())).await
}

/// Only an id from a fresh listing is accepted; writes just the StartupApproved flag.
#[tauri::command]
pub async fn set_startup_enabled(id: String, enabled: bool) -> Result<(), String> {
    if !cfg!(windows) { return Err("the startup manager is Windows-only".into()) }
    super::pc_cmd::blocking(move || {
        let e = list().into_iter().find(|e| e.id == id).ok_or("that startup entry no longer exists")?;
        let (_, hive, sub) = sources().into_iter().find(|s| s.0 == e.source).ok_or("unknown source")?;
        let key = format!(r"{hive}\{APPROVED}\{sub}");
        run_fixed("reg", &["add", &key, "/v", &e.name, "/t", "REG_BINARY", "/d", if enabled { ON } else { OFF }, "/f"])
            .map(|_| ())
            .map_err(|m| if hive == "HKLM" { format!("{m} (machine-wide entries need admin)") } else { m })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_reg_and_flags() {
        let t = "\r\nHKEY_CURRENT_USER\\Software\\...\\Run\r\n    OneDrive    REG_SZ    \"C:\\x\\OneDrive.exe\" /background\r\n    Spotify    REG_BINARY    030000001234\r\n";
        let v = parse_reg(t);
        assert_eq!(v.len(), 2);
        assert_eq!(v[0].0, "OneDrive");
        assert_eq!(v[0].2, "\"C:\\x\\OneDrive.exe\" /background");
        assert!(!approved(Some(&v[1].2)));
        assert!(approved(Some(ON)) && !approved(Some(OFF)) && approved(None));
    }
}
