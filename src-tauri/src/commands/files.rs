use serde::Serialize;

#[derive(Serialize)]
pub struct TempFile {
    path: String,
    size_bytes: u64,
}

// PC Care cleanup, scoped to exactly one allowlisted category: the OS temp
// directory (`std::env::temp_dir()` — e.g. %TEMP% on Windows). Never touches
// Documents, Downloads, browser profiles, or anything outside this one path,
// per the "never delete user documents/unknown files" rule. Read-only
// listing — nothing is deleted here.
#[tauri::command]
pub fn preview_temp_cleanup() -> Result<Vec<TempFile>, String> {
    let dir = std::env::temp_dir();
    let mut out = Vec::new();
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if let Ok(meta) = entry.metadata() {
            if meta.is_file() {
                out.push(TempFile {
                    path: entry.path().to_string_lossy().into_owned(),
                    size_bytes: meta.len(),
                });
            }
        }
    }
    Ok(out)
}

// Deletes exactly the paths it's given — the TS side always calls this with
// paths that came from `preview_temp_cleanup`'s own output, never a
// user-typed path, so this can't be pointed outside the temp dir by a bad
// argument from anywhere else in the app.
#[tauri::command]
pub fn apply_temp_cleanup(paths: Vec<String>) -> (u32, u32) {
    let mut deleted = 0;
    let mut failed = 0;
    let temp_dir = std::env::temp_dir();
    for p in paths {
        let path = std::path::Path::new(&p);
        // Defense in depth: refuse anything not actually inside temp_dir,
        // even though the TS caller should never send such a path.
        if !path.starts_with(&temp_dir) {
            failed += 1;
            continue;
        }
        match std::fs::remove_file(path) {
            Ok(()) => deleted += 1,
            Err(_) => failed += 1,
        }
    }
    (deleted, failed)
}

#[derive(Serialize)]
pub struct FoundFile {
    path: String,
}

// Bounded recursive filename search — std library only, no indexing crate.
// Deliberately scoped: only searches the folders the caller passes (which
// the TS module keeps in its own `search_roots` table, user-added one at a
// time), stops descending past `max_depth`, and caps total results so a
// huge folder can't make this hang.
fn walk_search(dir: &std::path::Path, query: &str, depth: u32, max_depth: u32, out: &mut Vec<FoundFile>) {
    if depth > max_depth || out.len() >= 500 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        if out.len() >= 500 {
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if name.contains(&query.to_lowercase()) {
            out.push(FoundFile { path: path.to_string_lossy().into_owned() });
        }
        if path.is_dir() {
            walk_search(&path, query, depth + 1, max_depth, out);
        }
    }
}

#[tauri::command]
pub fn search_files(root: String, query: String) -> Vec<FoundFile> {
    let mut out = Vec::new();
    walk_search(std::path::Path::new(&root), &query, 0, 12, &mut out);
    out
}

#[cfg(test)]
mod search_tests {
    use super::*;
    use std::fs;

    // Builds a throwaway tree under the OS temp dir, runs the test, then
    // removes it — no fixture files checked into the repo.
    struct TempTree {
        root: std::path::PathBuf,
    }
    impl TempTree {
        fn new(name: &str) -> Self {
            let root = std::env::temp_dir().join(format!("sentinel-test-{name}"));
            let _ = fs::remove_dir_all(&root);
            fs::create_dir_all(&root).unwrap();
            TempTree { root }
        }
    }
    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn finds_a_matching_file_by_name_case_insensitively() {
        let tree = TempTree::new("match");
        fs::write(tree.root.join("Report.pdf"), b"x").unwrap();
        fs::write(tree.root.join("notes.txt"), b"x").unwrap();

        let mut out = Vec::new();
        walk_search(&tree.root, "report", 0, 12, &mut out);
        assert_eq!(out.len(), 1);
        assert!(out[0].path.ends_with("Report.pdf"));
    }

    #[test]
    fn descends_into_subdirectories() {
        let tree = TempTree::new("nested");
        let sub = tree.root.join("sub");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("deep-match.txt"), b"x").unwrap();

        let mut out = Vec::new();
        walk_search(&tree.root, "deep-match", 0, 12, &mut out);
        assert_eq!(out.len(), 1);
    }

    #[test]
    fn respects_max_depth() {
        let tree = TempTree::new("depth");
        let mut dir = tree.root.clone();
        for i in 0..5 {
            dir = dir.join(format!("d{i}"));
        }
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("too-deep.txt"), b"x").unwrap();

        let mut out = Vec::new();
        // max_depth 2: five levels of subfolders is well past it, should find nothing.
        walk_search(&tree.root, "too-deep", 0, 2, &mut out);
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn caps_total_results_at_500() {
        let tree = TempTree::new("cap");
        for i in 0..520 {
            fs::write(tree.root.join(format!("match-{i}.txt")), b"x").unwrap();
        }

        let mut out = Vec::new();
        walk_search(&tree.root, "match", 0, 12, &mut out);
        assert_eq!(out.len(), 500);
    }

    #[test]
    fn finds_nothing_for_a_non_matching_query() {
        let tree = TempTree::new("nomatch");
        fs::write(tree.root.join("file.txt"), b"x").unwrap();

        let mut out = Vec::new();
        walk_search(&tree.root, "zzz-no-such-thing", 0, 12, &mut out);
        assert_eq!(out.len(), 0);
    }
}

// Plain text file write — used by Pentest Lab's report generator. No
// overwrite confirmation here; the TS side builds a unique, timestamped
// filename before calling this.
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

