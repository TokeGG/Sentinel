// App-owned skills dir: <app data>/skills/<skill|mcp>/<id>/... Every path is
// validated here (the TS side validates too, but is not trusted). Nothing is
// ever written, read or removed outside that dir.
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const MAX_FILES: usize = 200;
const MAX_FILE: usize = 512 * 1024;
const MAX_TOTAL: usize = 4 * 1024 * 1024;

#[derive(Deserialize)]
pub struct SkillFile {
    pub path: String,
    pub content: String,
}

pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && !id.starts_with('.')
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '-' | '_' | '.'))
}

const RESERVED: [&str; 8] = ["con", "prn", "aux", "nul", "com1", "com2", "lpt1", "lpt2"];

/// Relative '/'-separated path -> PathBuf, or None for anything that could leave the dir.
pub fn clean_rel(p: &str) -> Option<PathBuf> {
    if p.is_empty() || p.len() > 240 {
        return None;
    }
    let mut out = PathBuf::new();
    for seg in p.split('/') {
        let stem = seg.split('.').next().unwrap_or("").to_ascii_lowercase();
        let bad = seg.is_empty()
            || seg == "."
            || seg == ".."
            || seg.ends_with('.')
            || seg.ends_with(' ')
            || RESERVED.contains(&stem.as_str())
            || seg.chars().any(|c| c.is_control() || "\\:*?\"<>|".contains(c));
        if bad {
            return None;
        }
        out.push(seg);
    }
    Some(out)
}

fn kind_dir(kind: &str) -> Result<&'static str, String> {
    match kind {
        "skill" => Ok("skill"),
        "mcp" => Ok("mcp"),
        _ => Err(format!("unknown kind {kind}")),
    }
}

pub fn install_dir(app: &AppHandle, kind: &str, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err(format!("invalid id {id:?}"));
    }
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join("skills").join(kind_dir(kind)?).join(id))
}

/// Validates every file, writes to a staging dir, then swaps it in (replaces any previous install).
pub fn write_all(dir: &Path, files: &[SkillFile]) -> Result<(), String> {
    if files.is_empty() || files.len() > MAX_FILES {
        return Err("bad file count".into());
    }
    let mut total = 0;
    let mut rels = Vec::new();
    for f in files {
        let rel = clean_rel(&f.path).ok_or_else(|| format!("unsafe path {:?}", f.path))?;
        if f.content.len() > MAX_FILE || f.content.contains('\0') {
            return Err(format!("{} is too large or not text", f.path));
        }
        total += f.content.len();
        rels.push(rel);
    }
    if total > MAX_TOTAL {
        return Err("install is too large".into());
    }
    let name = dir.file_name().and_then(|n| n.to_str()).ok_or("bad dir")?;
    let stage = dir.with_file_name(format!(".staging-{name}"));
    let _ = std::fs::remove_dir_all(&stage);
    for (rel, f) in rels.iter().zip(files) {
        let to = stage.join(rel);
        std::fs::create_dir_all(to.parent().ok_or("bad path")?).map_err(|e| e.to_string())?;
        std::fs::write(&to, f.content.as_bytes()).map_err(|e| e.to_string())?;
    }
    let _ = std::fs::remove_dir_all(dir);
    std::fs::rename(&stage, dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn skills_write(app: AppHandle, kind: String, id: String, files: Vec<SkillFile>) -> Result<(), String> {
    write_all(&install_dir(&app, &kind, &id)?, &files)
}

#[tauri::command]
pub fn skills_remove(app: AppHandle, kind: String, id: String) -> Result<(), String> {
    match std::fs::remove_dir_all(install_dir(&app, &kind, &id)?) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

/// Reads one text file (e.g. SKILL.md) of an installed item.
#[tauri::command]
pub fn skills_read_file(app: AppHandle, kind: String, id: String, path: String) -> Result<String, String> {
    let rel = clean_rel(&path).ok_or("unsafe path")?;
    let p = install_dir(&app, &kind, &id)?.join(rel);
    if std::fs::metadata(&p).map_err(|e| e.to_string())?.len() as usize > MAX_FILE {
        return Err("file too large".into());
    }
    std::fs::read_to_string(p).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_and_paths() {
        assert!(valid_id("owner-repo.v2") && !valid_id("../x") && !valid_id("") && !valid_id(".staging-x") && !valid_id("A"));
        for ok in ["SKILL.md", "a/b/c.txt", "src/.hidden"] {
            assert!(clean_rel(ok).is_some(), "{ok}");
        }
        for bad in ["", "/etc/passwd", "../x", "a/../b", "a//b", "a\\b", "C:/x", "a/./b", "nul.txt", "a/aux", "x.", "a/b\0c", "a/b "] {
            assert!(clean_rel(bad).is_none(), "{bad:?}");
        }
    }

    #[test]
    fn write_all_swaps_and_refuses_bad() {
        let root = std::env::temp_dir().join(format!("sentinel-skills-test-{}", std::process::id()));
        let dir = root.join("demo");
        let f = |p: &str, c: &str| SkillFile { path: p.into(), content: c.into() };
        write_all(&dir, &[f("SKILL.md", "one"), f("sub/a.txt", "x")]).unwrap();
        write_all(&dir, &[f("SKILL.md", "two")]).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("SKILL.md")).unwrap(), "two");
        assert!(!dir.join("sub").exists());
        assert!(write_all(&dir, &[f("../evil", "x")]).is_err());
        assert!(write_all(&dir, &[f("ok", "a\0b")]).is_err());
        assert_eq!(std::fs::read_to_string(dir.join("SKILL.md")).unwrap(), "two");
        let _ = std::fs::remove_dir_all(root);
    }
}
