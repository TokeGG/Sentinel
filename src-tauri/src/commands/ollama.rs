use super::http_out::{client, read, HttpOut};
use serde::Serialize;

// Local model access for the bot / skills: talks ONLY to http://127.0.0.1:11434,
// fixed path allow-list. Sent from Rust, so no webview Origin header (Ollama answers
// 403 to Origin http(s)://tauri.localhost, the WebView2 origin on Windows).
const BASE: &str = "http://127.0.0.1:11434";
const PATHS: &[&str] = &["/api/tags", "/api/chat", "/api/version", "/api/show", "/api/ps"];

pub fn allowed(path: &str) -> bool {
    PATHS.contains(&path)
}

#[tauri::command]
pub async fn ollama_request(path: String, body: Option<String>, timeout_secs: Option<u64>) -> Result<HttpOut, String> {
    if !allowed(&path) {
        return Err(format!("refusing Ollama path {path}"));
    }
    let c = client(timeout_secs.unwrap_or(120), true)?;
    let req = match body {
        Some(b) => c.post(format!("{BASE}{path}")).header("Content-Type", "application/json").body(b),
        None => c.get(format!("{BASE}{path}")),
    };
    let res = req.send().await.map_err(|e| {
        if e.is_connect() { "not_running: nothing answers on 127.0.0.1:11434".to_string() } else if e.is_timeout() { "timeout: Ollama did not answer in time".to_string() } else { format!("ollama: {e}") }
    })?;
    read(res, 8 << 20).await
}

#[derive(Serialize)]
pub struct OllamaInstall {
    installed: bool,
    path: Option<String>,
}

/// Is the Ollama program on this PC? (PATH, or the default Windows install folder.) Reads only.
#[tauri::command]
pub fn ollama_installed() -> OllamaInstall {
    let exe = if cfg!(windows) { "ollama.exe" } else { "ollama" };
    let mut dirs: Vec<std::path::PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    if let Some(l) = std::env::var_os("LOCALAPPDATA") {
        dirs.push(std::path::PathBuf::from(l).join("Programs").join("Ollama"));
    }
    let hit = dirs.into_iter().map(|d| d.join(exe)).find(|p| p.is_file());
    OllamaInstall { installed: hit.is_some(), path: hit.map(|p| p.display().to_string()) }
}

#[cfg(test)]
mod tests {
    use super::allowed;
    #[test]
    fn path_allow_list() {
        assert!(allowed("/api/chat"));
        assert!(allowed("/api/tags"));
        assert!(!allowed("/api/pull"));
        assert!(!allowed("/api/delete"));
        assert!(!allowed("//evil.com/api/chat"));
    }
}
