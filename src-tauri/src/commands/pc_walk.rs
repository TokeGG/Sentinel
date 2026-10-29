// Bounded folder walker for PC Care: largest files + per-child sizes (treemap) and the file list
// the duplicate finder groups. Read-only. Never follows symlinks; stops at MAX_FILES.
use serde::Serialize;
use std::path::{Path, PathBuf};

pub const MAX_FILES: usize = 200_000;
const TOP: usize = 50;

#[derive(Serialize, Clone)]
pub struct Sized { pub path: String, pub size: u64 }

#[derive(Serialize, Default)]
pub struct FolderScan { total: u64, files: usize, truncated: bool, largest: Vec<Sized>, children: Vec<Child> }

#[derive(Serialize)]
pub struct Child { name: String, size: u64, dir: bool }

/// Calls `f(path, size)` for every regular file under `root` (depth-first, symlinks skipped).
/// Returns true when it stopped early at `max`.
pub fn walk(root: &Path, max: usize, f: &mut dyn FnMut(&Path, u64)) -> bool {
    let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];
    let mut n = 0usize;
    while let Some(dir) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&dir) else { continue };
        for e in rd.flatten() {
            let Ok(ft) = e.file_type() else { continue };
            if ft.is_symlink() { continue }
            if ft.is_dir() { stack.push(e.path()); continue }
            if !ft.is_file() { continue }
            n += 1;
            if n > max { return true }
            f(&e.path(), e.metadata().map(|m| m.len()).unwrap_or(0));
        }
    }
    false
}

pub fn check_root(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_absolute() || !p.is_dir() { return Err("pick an existing folder".into()) }
    Ok(p)
}

pub fn scan(root: &Path, max: usize) -> FolderScan {
    let mut s = FolderScan::default();
    let mut kids: std::collections::BTreeMap<String, (u64, bool)> = Default::default();
    let mut all: Vec<Sized> = Vec::new();
    s.truncated = walk(root, max, &mut |p, size| {
        s.total += size;
        s.files += 1;
        if let Ok(rel) = p.strip_prefix(root) {
            let mut comps = rel.components();
            let first = comps.next().map(|c| c.as_os_str().to_string_lossy().into_owned()).unwrap_or_default();
            let e = kids.entry(first).or_insert((0, comps.next().is_some()));
            e.0 += size;
        }
        all.push(Sized { path: p.to_string_lossy().into_owned(), size });
        if all.len() > TOP * 4 { all.sort_by(|a, b| b.size.cmp(&a.size)); all.truncate(TOP); }
    });
    all.sort_by(|a, b| b.size.cmp(&a.size));
    all.truncate(TOP);
    s.largest = all;
    s.children = kids.into_iter().map(|(name, (size, dir))| Child { name, size, dir }).collect();
    s.children.sort_by(|a, b| b.size.cmp(&a.size));
    s
}

#[tauri::command]
pub async fn scan_folder(path: String) -> Result<FolderScan, String> {
    super::pc_cmd::blocking(move || Ok(scan(&check_root(&path)?, MAX_FILES))).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scans_sizes_children_and_cap() {
        let d = std::env::temp_dir().join(format!("sn-walk-{}", std::process::id()));
        std::fs::create_dir_all(d.join("sub")).unwrap();
        std::fs::write(d.join("a.bin"), vec![0u8; 10]).unwrap();
        std::fs::write(d.join("sub/b.bin"), vec![0u8; 30]).unwrap();
        let s = scan(&d, 100);
        assert_eq!(s.total, 40);
        assert_eq!(s.largest[0].size, 30);
        assert_eq!(s.children[0].name, "sub");
        assert!(s.children[0].dir && !s.children[1].dir);
        assert!(scan(&d, 1).truncated);
        std::fs::remove_dir_all(&d).ok();
        assert!(check_root("relative").is_err());
    }
}
