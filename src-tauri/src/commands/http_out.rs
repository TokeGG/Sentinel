use serde::Serialize;
use std::time::Duration;
use tauri_plugin_http::reqwest;

// Shared helper for Rust-side HTTP: requests sent from Rust carry NO browser `Origin`
// header (the http plugin always adds the webview origin, which Ollama answers with
// 403 and Microsoft's token endpoint rejects for native clients).
#[derive(Serialize)]
pub struct HttpOut {
    pub status: u16,
    pub body: String,
}

pub fn client(timeout_secs: u64, direct: bool) -> Result<reqwest::Client, String> {
    let mut b = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs.clamp(1, 600)))
        .redirect(reqwest::redirect::Policy::none());
    if direct {
        b = b.no_proxy();
    }
    b.build().map_err(|e| e.to_string())
}

pub async fn read(res: reqwest::Response, cap: usize) -> Result<HttpOut, String> {
    let status = res.status().as_u16();
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    let body = String::from_utf8_lossy(&bytes[..bytes.len().min(cap)]).into_owned();
    Ok(HttpOut { status, body })
}
