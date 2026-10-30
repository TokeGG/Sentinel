use super::http_out::{client, read, HttpOut};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tauri_plugin_http::reqwest;

// Model manager for the local Ollama (127.0.0.1:11434 only): pull with progress events,
// delete (the UI confirms first), unload (keep_alive 0). Model names are validated.
const BASE: &str = "http://127.0.0.1:11434";

pub fn valid_name(n: &str) -> bool {
    !n.is_empty()
        && n.len() <= 120
        && !n.contains("..")
        && n.chars()
            .all(|c| c.is_ascii_alphanumeric() || "._:/-".contains(c))
}

fn net(e: impl std::fmt::Display) -> String {
    format!("ollama: {e}")
}

/// Pull a model; emits `ollama-pull` {name, status, completed, total} per progress line.
#[tauri::command]
pub async fn ollama_pull(app: AppHandle, name: String) -> Result<String, String> {
    if !valid_name(&name) {
        return Err("bad model name".into());
    }
    let c = client(600, true)?;
    let mut res: reqwest::Response = c
        .post(format!("{BASE}/api/pull"))
        .header("Content-Type", "application/json")
        .body(json!({ "name": name, "stream": true }).to_string())
        .send()
        .await
        .map_err(net)?;
    if !res.status().is_success() {
        return Err(format!("ollama: HTTP {}", res.status()));
    }
    let (mut buf, mut last) = (String::new(), String::new());
    while let Some(chunk) = res.chunk().await.map_err(net)? {
        buf.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(i) = buf.find('\n') {
            let line: String = buf.drain(..=i).collect();
            if let Ok(v) = serde_json::from_str::<Value>(line.trim()) {
                if let Some(e) = v.get("error").and_then(|e| e.as_str()) {
                    return Err(format!("ollama: {e}"));
                }
                last = v
                    .get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("")
                    .to_string();
                let _ = app.emit("ollama-pull", json!({ "name": name, "status": last, "completed": v.get("completed"), "total": v.get("total") }));
            }
        }
    }
    Ok(last)
}

#[tauri::command]
pub async fn ollama_delete(name: String) -> Result<HttpOut, String> {
    if !valid_name(&name) {
        return Err("bad model name".into());
    }
    let res = client(30, true)?
        .delete(format!("{BASE}/api/delete"))
        .header("Content-Type", "application/json")
        .body(json!({ "name": name }).to_string())
        .send()
        .await
        .map_err(net)?;
    read(res, 1 << 16).await
}

#[tauri::command]
pub async fn ollama_unload(name: String) -> Result<HttpOut, String> {
    if !valid_name(&name) {
        return Err("bad model name".into());
    }
    let res = client(30, true)?
        .post(format!("{BASE}/api/generate"))
        .header("Content-Type", "application/json")
        .body(json!({ "model": name, "keep_alive": 0 }).to_string())
        .send()
        .await
        .map_err(net)?;
    read(res, 1 << 16).await
}

#[cfg(test)]
mod tests {
    use super::valid_name;
    #[test]
    fn names() {
        assert!(valid_name("llama3.1:8b"));
        assert!(valid_name("hf.co/user/model:q4"));
        assert!(!valid_name(""));
        assert!(!valid_name("a b"));
        assert!(!valid_name("../x"));
        assert!(!valid_name("x;rm"));
    }
}
