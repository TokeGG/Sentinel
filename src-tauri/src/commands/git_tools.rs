// Read-only git helpers for cloned repos: `git status --porcelain` (no prompts, no network) and the
// secret scanner (redacted matches only). Both require a real clone dir (cloned::check_clone_dir).
use super::cloned::check_clone_dir;
use super::pc_cmd::{blocking, run_fixed};
use serde::Serialize;
use std::path::Path;

#[tauri::command]
pub async fn git_status(path: String) -> Result<String, String> {
    blocking(move || {
        let p = check_clone_dir(&path)?.to_string_lossy().into_owned();
        run_fixed("git", &["-C", &p, "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-b"])
    }).await
}

#[derive(Serialize, Debug)]
pub struct Hit { file: String, line: usize, rule: String, preview: String }

const RULES: [(&str, &str); 7] = [
    ("AWS access key", r"AKIA[0-9A-Z]{16}"),
    ("GitHub token", r"gh[pousr]_[A-Za-z0-9]{36,}"),
    ("Slack token", r"xox[baprs]-[A-Za-z0-9-]{10,}"),
    ("Google API key", r"AIza[0-9A-Za-z_\-]{35}"),
    ("Private key", r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    ("Stripe live key", r"sk_live_[0-9a-zA-Z]{24,}"),
    ("Generic secret", r#"(?i)(api_?key|secret|password|token)\s*[:=]\s*["'][^"'\s]{12,}["']"#),
];
const SKIP: [&str; 5] = [".git", "node_modules", "target", "dist", ".venv"];
const MAX_FILE: u64 = 1024 * 1024;

/// Keeps the first 4 characters, masks the rest. A full secret is never returned.
pub fn redact(s: &str) -> String {
    let head: String = s.chars().take(4).collect();
    format!("{head}{}", "*".repeat(8))
}

pub fn scan_text(file: &str, text: &str, out: &mut Vec<Hit>) {
    let rules: Vec<_> = RULES.iter().map(|(n, r)| (*n, regex_lite::Regex::new(r).unwrap())).collect();
    for (i, l) in text.lines().enumerate() {
        for (name, re) in &rules {
            if let Some(m) = re.find(l) {
                out.push(Hit { file: file.into(), line: i + 1, rule: (*name).into(), preview: redact(m.as_str()) });
                break;
            }
        }
    }
}

pub fn scan_dir(root: &Path) -> Vec<Hit> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    let mut files = 0;
    while let Some(d) = stack.pop() {
        for e in std::fs::read_dir(&d).into_iter().flatten().flatten() {
            let (Ok(ft), name) = (e.file_type(), e.file_name().to_string_lossy().into_owned()) else { continue };
            if ft.is_symlink() || SKIP.contains(&name.as_str()) { continue }
            if ft.is_dir() { stack.push(e.path()); continue }
            files += 1;
            if files > 20_000 || out.len() > 500 { return out }
            if e.metadata().map(|m| m.len() > MAX_FILE).unwrap_or(true) { continue }
            let Ok(text) = std::fs::read_to_string(e.path()) else { continue };
            let rel = e.path().strip_prefix(root).map(|p| p.to_string_lossy().into_owned()).unwrap_or(name);
            scan_text(&rel, &text, &mut out);
        }
    }
    out
}

#[tauri::command]
pub async fn scan_secrets(path: String) -> Result<Vec<Hit>, String> {
    blocking(move || Ok(scan_dir(check_clone_dir(&path)?))).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn finds_and_redacts() {
        let mut v = Vec::new();
        let key = "AKIAABCDEFGHIJKLMNOP";
        scan_text("a.env", &format!("x\nAWS={key}\napi_key = \"abcdefghijklmnop\"\nnothing"), &mut v);
        assert_eq!(v.len(), 2);
        assert_eq!((v[0].line, v[0].rule.as_str()), (2, "AWS access key"));
        assert_eq!(v[0].preview, "AKIA********");
        assert!(!v.iter().any(|h| h.preview.contains("ABCDEFGH")));
        assert_eq!(v[1].rule, "Generic secret");
    }
}
