use super::http_out::{client, read, HttpOut};
use std::collections::HashMap;

// HTTPS request for the account-connect flow (token exchange, refresh, device code,
// identity, Mastodon app registration), sent from Rust so no webview Origin header
// is attached. https only, GET/POST only, no redirects, body capped at 1 MB.
// Bodies and headers are never logged.
pub fn check_url(url: &str) -> Result<(), String> {
    let rest = url.strip_prefix("https://").ok_or("only https:// URLs are allowed")?;
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    if host.is_empty() || host.contains('@') {
        return Err("bad URL host".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn oauth_http(method: String, url: String, headers: Option<HashMap<String, String>>, body: Option<String>) -> Result<HttpOut, String> {
    check_url(&url)?;
    let c = client(30, false)?;
    let mut req = match method.as_str() {
        "GET" => c.get(&url),
        "POST" => c.post(&url),
        _ => return Err("only GET and POST are allowed".into()),
    };
    for (k, v) in headers.unwrap_or_default() {
        if k.eq_ignore_ascii_case("origin") || k.eq_ignore_ascii_case("host") {
            continue;
        }
        req = req.header(k, v);
    }
    if let Some(b) = body {
        req = req.body(b);
    }
    let host = url.trim_start_matches("https://").split('/').next().unwrap_or("").to_string();
    let res = req.send().await.map_err(|e| {
        if e.is_timeout() { format!("{host} did not answer within 30 s") } else if e.is_connect() { format!("could not reach {host} (offline, DNS or firewall?)") } else { format!("request to {host} failed: {e}") }
    })?;
    read(res, 1 << 20).await
}

#[cfg(test)]
mod tests {
    use super::check_url;
    #[test]
    fn only_https_with_host() {
        assert!(check_url("https://oauth2.googleapis.com/token").is_ok());
        assert!(check_url("http://example.com").is_err());
        assert!(check_url("https:///x").is_err());
        assert!(check_url("https://user@evil.com/").is_err());
        assert!(check_url("file:///c:/x").is_err());
    }
}
