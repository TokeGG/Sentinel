// File listing + planned moves for the download sorter and screenshot organizer. The plan is built
// and previewed in TS (pure); this re-checks every move: source is a direct file child of `base`,
// target is base/<one safe folder>/<name>, nothing is overwritten.
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

const MAX_LIST: usize = 5000;

#[derive(Serialize)]
pub struct DirFile { name: String, size: u64, modified: u64 }

#[derive(Deserialize)]
pub struct Move { from: String, folder: String, name: String }

pub fn safe_part(s: &str) -> bool {
    !s.is_empty() && s.len() <= 120 && s != "." && s != ".."
        && !s.chars().any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control())
}

pub fn check_move(base: &Path, m: &Move) -> Result<(PathBuf, PathBuf), String> {
    let from = PathBuf::from(&m.from);
    if from.parent() != Some(base) || from.components().any(|c| c == Component::ParentDir) || !from.is_file() {
        return Err(format!("{} is not a file directly in the folder", m.from));
    }
    if !safe_part(&m.folder) || !safe_part(&m.name) { return Err("bad target name".into()) }
    let to = base.join(&m.folder).join(&m.name);
    if to.exists() { return Err(format!("{} already exists; nothing overwritten", to.display())) }
    Ok((from, to))
}

#[tauri::command]
pub async fn list_dir_files(path: String) -> Result<Vec<DirFile>, String> {
    super::pc_cmd::blocking(move || {
        let base = super::pc_walk::check_root(&path)?;
        let rd = std::fs::read_dir(&base).map_err(|e| e.to_string())?;
        Ok(rd.flatten().filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false)).take(MAX_LIST).map(|e| {
            let md = e.metadata().ok();
            let modified = md.as_ref().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
            DirFile { name: e.file_name().to_string_lossy().into_owned(), size: md.map(|m| m.len()).unwrap_or(0), modified }
        }).collect())
    }).await
}

/// All moves are validated first; if any fails, nothing moves. Returns how many moved.
#[tauri::command]
pub async fn apply_moves(base: String, moves: Vec<Move>) -> Result<usize, String> {
    super::pc_cmd::blocking(move || {
        let b = super::pc_walk::check_root(&base)?;
        let checked = moves.iter().map(|m| check_move(&b, m)).collect::<Result<Vec<_>, _>>()?;
        let mut n = 0;
        for (from, to) in checked {
            if let Some(d) = to.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())? }
            if to.exists() { continue }
            std::fs::rename(&from, &to).map_err(|e| format!("moved {n}, then failed: {e}"))?;
            n += 1;
        }
        Ok(n)
    }).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_moves() {
        let d = std::env::temp_dir().join(format!("sn-mv-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("a.pdf"), b"x").unwrap();
        let m = |f: &str, folder: &str, n: &str| Move { from: d.join(f).to_string_lossy().into(), folder: folder.into(), name: n.into() };
        assert!(check_move(&d, &m("a.pdf", "Docs", "a.pdf")).is_ok());
        assert!(check_move(&d, &m("a.pdf", "..", "a.pdf")).is_err());
        assert!(check_move(&d, &m("a.pdf", "x/y", "a.pdf")).is_err());
        assert!(check_move(&d, &m("nope", "Docs", "n")).is_err());
        assert!(check_move(Path::new("/"), &m("a.pdf", "Docs", "a.pdf")).is_err());
        std::fs::remove_dir_all(&d).ok();
    }
}
