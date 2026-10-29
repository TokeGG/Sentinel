// clone_repo: shells out to `git`, nothing more ("install" = clone, never run). Sync
// commands run on the main thread, so this runs on a blocking thread: stdin closed,
// prompts off, 15 min timeout + kill, only the first 8 KB of stderr kept.
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const TIMEOUT: Duration = Duration::from_secs(15 * 60);
const MAX_ERR: usize = 8 * 1024;

/// "https://github.com/owner/repo(.git)(/)" -> ("owner", "repo"). https only, no credentials.
pub fn parse_repo_url(url: &str) -> Result<(String, String), String> {
    let rest = url.trim().strip_prefix("https://").ok_or("only https:// repository URLs can be cloned")?;
    let (host, path) = rest.split_once('/').ok_or("that URL has no repository path")?;
    if !matches!(host, "github.com" | "www.github.com") {
        return Err("only github.com repositories can be cloned here".into());
    }
    let mut parts = path.trim_end_matches('/').split('/');
    let (owner, repo) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
    let repo = repo.strip_suffix(".git").unwrap_or(repo);
    if parts.next().is_some() || !safe_segment(owner) || !safe_segment(repo) {
        return Err("that doesn't look like a github.com/owner/repo URL".into());
    }
    Ok((owner.to_string(), repo.to_string()))
}

fn safe_segment(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 100
        && s != "."
        && s != ".."
        && !s.ends_with('.')
        && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

fn reserved(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((stem.starts_with("COM") || stem.starts_with("LPT")) && stem.len() == 4 && stem.ends_with(|c: char| c.is_ascii_digit()))
}

/// The folder git will create: `<parent>/<repo>`. Parent must be an existing directory; target must not exist.
pub fn build_target(parent: &str, repo: &str) -> Result<PathBuf, String> {
    let p = Path::new(parent.trim());
    if parent.trim().is_empty() || !p.is_absolute() {
        return Err("pick a destination folder first".into());
    }
    if !p.is_dir() {
        return Err(format!("the destination folder doesn't exist: {}", p.display()));
    }
    if reserved(repo) {
        return Err(format!("\"{repo}\" can't be used as a folder name on Windows"));
    }
    let target = p.join(repo);
    if target.exists() {
        return Err(format!("{} already exists; pick another folder or remove it first", target.display()));
    }
    Ok(target)
}

/// Turns git's stderr into something readable.
pub fn map_git_error(stderr: &str) -> String {
    let s = stderr.to_lowercase();
    let msg = if s.contains("repository not found") || s.contains("not found") && s.contains("repository") {
        "repository not found (it may be private or the name is wrong)"
    } else if s.contains("terminal prompts disabled") || s.contains("authentication failed") || s.contains("could not read username") {
        "git needs a login for this repository; it is private or requires credentials (prompts are disabled)"
    } else if s.contains("could not resolve host") || s.contains("unable to access") || s.contains("timed out") {
        "couldn't reach github.com; check your connection"
    } else if s.contains("already exists and is not an empty directory") {
        "the destination folder already exists"
    } else if s.contains("filename too long") || s.contains("invalid path") {
        "a path in this repository is too long or invalid for Windows; pick a shorter destination folder"
    } else {
        return format!("git clone failed: {}", stderr.trim().lines().last().unwrap_or("unknown error"));
    };
    msg.to_string()
}

fn run_git(url: String, target: PathBuf) -> Result<(), String> {
    let mut cmd = Command::new("git");
    cmd.args(["clone", "--quiet", "--", &url])
        .arg(&target)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never")
        .env("GIT_ASKPASS", "")
        .env("GIT_SSH_COMMAND", "ssh -o BatchMode=yes")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000); // no console flash
    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "git isn't installed or isn't on PATH; install Git for Windows and restart Sentinel".to_string()
        } else {
            format!("couldn't start git: {e}")
        }
    })?;
    // Keep only the first MAX_ERR bytes of stderr, drain the rest so git never blocks on a full pipe.
    let mut pipe = child.stderr.take();
    let reader = std::thread::spawn(move || {
        let mut kept = Vec::new();
        let mut buf = [0u8; 4096];
        while let Some(Ok(n)) = pipe.as_mut().map(|p| p.read(&mut buf)) {
            if n == 0 {
                break;
            }
            if kept.len() < MAX_ERR {
                kept.extend_from_slice(&buf[..n.min(MAX_ERR - kept.len())]);
            }
        }
        String::from_utf8_lossy(&kept).into_owned()
    });
    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break Ok(s),
            Ok(None) if start.elapsed() > TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = std::fs::remove_dir_all(&target); // target did not exist before this call
                return Err("git clone timed out after 15 minutes and was stopped".into());
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(200)),
            Err(e) => break Err(format!("lost track of git: {e}")),
        }
    }?;
    let err = reader.join().unwrap_or_default();
    if status.success() {
        Ok(())
    } else {
        let _ = std::fs::remove_dir_all(&target);
        Err(map_git_error(&err))
    }
}

/// Clones `url` into `<dest_dir>/<repo>` and returns that folder.
#[tauri::command]
pub async fn clone_repo(url: String, dest_dir: String) -> Result<String, String> {
    let target = build_target(&dest_dir, &parse_repo_url(&url)?.1)?;
    let out = target.clone();
    tauri::async_runtime::spawn_blocking(move || run_git(url.trim().to_string(), target))
        .await
        .map_err(|e| format!("clone task failed: {e}"))??;
    Ok(out.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_urls() {
        assert_eq!(parse_repo_url("https://github.com/o/r").unwrap(), ("o".into(), "r".into()));
        assert_eq!(parse_repo_url(" https://github.com/o/r.git/ ").unwrap().1, "r");
        assert_eq!(parse_repo_url("https://github.com/o/my.repo-1_x").unwrap().1, "my.repo-1_x");
    }

    #[test]
    fn rejects_bad_urls() {
        for u in ["", "--upload-pack=x", "http://github.com/o/r", "ssh://github.com/o/r", "https://evil.com/o/r",
            "https://github.com/o", "https://github.com/o/r/tree/x", "https://github.com/o/..", "https://github.com/o/r r",
            "https://user:pw@github.com/o/r", "https://github.com//r"] {
            assert!(parse_repo_url(u).is_err(), "{u}");
        }
    }

    #[test]
    fn target_validation() {
        let base = std::env::temp_dir().join(format!("sentinel-repo-test-{}", std::process::id()));
        std::fs::create_dir_all(base.join("taken")).unwrap();
        let spaced = base.join("with spaces");
        std::fs::create_dir_all(&spaced).unwrap();
        let b = base.to_str().unwrap();
        assert_eq!(build_target(b, "new").unwrap(), base.join("new"));
        assert!(build_target(spaced.to_str().unwrap(), "r").unwrap().ends_with("r"));
        assert!(build_target(b, "taken").unwrap_err().contains("already exists"));
        assert!(build_target(b, "NUL").is_err());
        assert!(build_target(b, "com1.txt").is_err());
        assert!(build_target("", "r").is_err());
        assert!(build_target("relative/dir", "r").is_err());
        assert!(build_target(base.join("missing").to_str().unwrap(), "r").unwrap_err().contains("doesn't exist"));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn maps_errors() {
        assert!(map_git_error("remote: Repository not found.\nfatal: ...").contains("not found"));
        assert!(map_git_error("fatal: could not read Username for 'https://github.com': terminal prompts disabled").contains("login"));
        assert!(map_git_error("fatal: unable to access: Could not resolve host: github.com").contains("reach"));
        assert!(map_git_error("weird\nlast line").ends_with("last line"));
        assert!(map_git_error("").contains("unknown error"));
    }
}
