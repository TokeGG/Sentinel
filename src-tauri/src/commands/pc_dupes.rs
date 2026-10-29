// Duplicate finder: group by size first, then SHA-256 only within same-size groups. Deleting goes to the
// Recycle Bin (`trash` crate) and only for paths under the scanned root that the preview listed.
use super::pc_walk::{check_root, walk, Sized, MAX_FILES};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const MIN_SIZE: u64 = 1;
const MAX_GROUPS: usize = 500;

pub fn find(root: &Path, max: usize) -> Vec<Vec<Sized>> {
    let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    walk(root, max, &mut |p, size| {
        if size >= MIN_SIZE { by_size.entry(size).or_default().push(p.to_path_buf()) }
    });
    let mut groups = Vec::new();
    let mut sizes: Vec<_> = by_size.into_iter().filter(|(_, v)| v.len() > 1).collect();
    sizes.sort_by(|a, b| b.0.cmp(&a.0));
    for (size, paths) in sizes {
        let mut by_hash: HashMap<String, Vec<Sized>> = HashMap::new();
        for p in paths {
            if let Ok(h) = super::pc_hash::sha256_file(&p) {
                by_hash.entry(h).or_default().push(Sized { path: p.to_string_lossy().into_owned(), size });
            }
        }
        for (_, mut g) in by_hash.into_iter().filter(|(_, g)| g.len() > 1) {
            g.sort_by(|a, b| a.path.cmp(&b.path));
            groups.push(g);
            if groups.len() >= MAX_GROUPS { return groups }
        }
    }
    groups
}

#[tauri::command]
pub async fn find_duplicates(path: String) -> Result<Vec<Vec<Sized>>, String> {
    super::pc_cmd::blocking(move || Ok(find(&check_root(&path)?, MAX_FILES))).await
}

/// Only absolute regular files strictly inside `root` (no `..`).
pub fn allowed(root: &Path, p: &Path) -> bool {
    p.is_absolute()
        && p.starts_with(root)
        && p != root
        && !p.components().any(|c| matches!(c, std::path::Component::ParentDir))
        && std::fs::symlink_metadata(p).map(|m| m.is_file()).unwrap_or(false)
}

/// Moves the previewed files to the Recycle Bin. Refuses (deletes nothing) if any path is outside root.
#[tauri::command]
pub async fn trash_files(root: String, paths: Vec<String>) -> Result<usize, String> {
    super::pc_cmd::blocking(move || {
        let r = check_root(&root)?;
        let ps: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
        if ps.is_empty() || ps.iter().any(|p| !allowed(&r, p)) {
            return Err("a path is outside the scanned folder or no longer a file; nothing deleted".into());
        }
        trash::delete_all(&ps).map_err(|e| format!("Recycle Bin refused ({e}); nothing deleted"))?;
        Ok(ps.len())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn groups_identical_only() {
        let d = std::env::temp_dir().join(format!("sn-dup-{}", std::process::id()));
        std::fs::create_dir_all(d.join("x")).unwrap();
        std::fs::write(d.join("a"), b"same").unwrap();
        std::fs::write(d.join("x/b"), b"same").unwrap();
        std::fs::write(d.join("c"), b"diff").unwrap();
        let g = find(&d, 100);
        assert_eq!(g.len(), 1);
        assert_eq!(g[0].len(), 2);
        assert!(allowed(&d, &d.join("a")));
        assert!(!allowed(&d, &d));
        assert!(!allowed(&d, Path::new("/etc/passwd")));
        assert!(!allowed(&d, &d.join("x/../a")));
        std::fs::remove_dir_all(&d).ok();
    }
}
