// Read-only/guarded helpers for the "Cloned repos" section of GitHub Discovery.
// Every command takes a folder path; each refuses anything that isn't an
// existing git clone directory, so these can't open a program or delete
// outside a cloned repo even if called with a bad path.
use serde::Serialize;
use std::path::Path;
use std::process::{Command, Stdio};

const MARKERS: [&str; 7] = ["package.json", "Cargo.toml", "pyproject.toml", "requirements.txt", "Makefile", "go.mod", "pom.xml"];
const MAX_ENTRIES: usize = 2000;
const MAX_PKG: u64 = 64 * 1024;

#[derive(Serialize, Default)]
pub struct ProjectInfo {
    exists: bool,
    /// Marker file names found at the top level (incl. any *.sln / *.csproj).
    markers: Vec<String>,
    /// Raw package.json text (<= 64 KB) so the UI can list npm scripts.
    package_json: Option<String>,
    /// Top-level entries seen (capped), shown in the delete preview.
    entries: usize,
}

fn is_marker(name: &str) -> bool {
    MARKERS.contains(&name) || name.ends_with(".sln") || name.ends_with(".csproj")
}

pub fn scan(dir: &Path) -> ProjectInfo {
    let Ok(rd) = std::fs::read_dir(dir) else { return ProjectInfo::default() };
    let mut info = ProjectInfo { exists: dir.is_dir(), ..Default::default() };
    for e in rd.flatten().take(MAX_ENTRIES) {
        info.entries += 1;
        let name = e.file_name().to_string_lossy().into_owned();
        if is_marker(&name) {
            info.markers.push(name);
        }
    }
    info.markers.sort();
    let pkg = dir.join("package.json");
    if info.markers.iter().any(|m| m == "package.json") && pkg.metadata().map(|m| m.len() <= MAX_PKG).unwrap_or(false) {
        info.package_json = std::fs::read_to_string(pkg).ok();
    }
    info
}

/// Absolute, existing, a real directory (not a symlink), with a `.git` inside, and not a shallow root.
pub fn check_clone_dir(path: &str) -> Result<&Path, String> {
    let p = Path::new(path);
    if !p.is_absolute() || p.components().count() < 3 {
        return Err("not a cloned repository folder".into());
    }
    let meta = std::fs::symlink_metadata(p).map_err(|_| "that folder no longer exists".to_string())?;
    if !meta.is_dir() || !p.join(".git").exists() {
        return Err("that folder isn't a git clone, refusing".into());
    }
    Ok(p)
}

#[tauri::command]
pub async fn project_info(path: String) -> Result<ProjectInfo, String> {
    tauri::async_runtime::spawn_blocking(move || scan(Path::new(&path)))
        .await
        .map_err(|e| e.to_string())
}

/// with = "folder" (Explorer) or "editor" (VS Code `code`, if installed).
#[tauri::command]
pub fn open_cloned(path: String, with: String) -> Result<(), String> {
    let p = check_clone_dir(&path)?;
    let mut cmd = match with.as_str() {
        "folder" => Command::new(if cfg!(windows) { "explorer" } else { "xdg-open" }),
        "editor" => Command::new(if cfg!(windows) { "code.cmd" } else { "code" }),
        _ => return Err("unknown open target".into()),
    };
    cmd.arg(p).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000);
    let mut child = cmd.spawn().map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound if with == "editor" => "VS Code (`code`) isn't on PATH".to_string(),
        _ => format!("couldn't open it: {e}"),
    })?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

/// Deletes the cloned folder. The UI only calls this after showing the exact path.
#[tauri::command]
pub async fn delete_cloned_dir(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = check_clone_dir(&path)?;
        std::fs::remove_dir_all(p).map_err(|e| format!("couldn't delete everything (a file may be open in another program): {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn tmp(name: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("sentinel-cloned-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn scan_finds_markers_and_package_json() {
        let d = tmp("scan");
        for f in ["package.json", "Cargo.toml", "app.sln", "x.csproj", "readme.md"] {
            fs::write(d.join(f), "{}").unwrap();
        }
        let i = scan(&d);
        assert!(i.exists);
        assert_eq!(i.markers, ["Cargo.toml", "app.sln", "package.json", "x.csproj"]);
        assert_eq!(i.package_json.as_deref(), Some("{}"));
        assert_eq!(i.entries, 5);
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn scan_missing_folder_is_not_exists() {
        assert!(!scan(Path::new("/definitely/not/here")).exists);
    }

    #[test]
    fn oversized_package_json_is_skipped() {
        let d = tmp("big");
        fs::write(d.join("package.json"), vec![b'a'; 70_000]).unwrap();
        assert!(scan(&d).package_json.is_none());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn guard_requires_a_git_clone() {
        let d = tmp("guard");
        assert!(check_clone_dir(d.to_str().unwrap()).is_err()); // no .git
        fs::create_dir_all(d.join(".git")).unwrap();
        assert!(check_clone_dir(d.to_str().unwrap()).is_ok());
        assert!(check_clone_dir("relative").is_err());
        assert!(check_clone_dir("/").is_err());
        assert!(check_clone_dir("/tmp").is_err());
        assert!(check_clone_dir("/nonexistent/a/b").is_err());
        let _ = fs::remove_dir_all(&d);
    }
}
