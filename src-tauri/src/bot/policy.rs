//! Pure rules for the bot browser: where it may navigate, what ids and scripts
//! the commands accept. The window has no IPC capability (checked by a test).
use tauri::Url;

/// Top-level navigation: http(s) only (never file:, javascript:, data:, blob:, tauri:, ...), and never the
/// app's own origin or a loopback host. Everything else on the web is open.
pub fn nav_allowed(url: &Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    let Some(host) = url.host_str().map(str::to_ascii_lowercase) else { return false };
    let host = host.trim_end_matches('.');
    !(host == "localhost" || host.ends_with(".localhost") || host == "127.0.0.1" || host == "[::1]" || host == "0.0.0.0" || host.ends_with("tauri.localhost"))
}
pub fn parse_nav(u: &str) -> Result<Url, String> {
    let url: Url = u.parse().map_err(|e| format!("{e}"))?;
    if nav_allowed(&url) { Ok(url) } else { Err(format!("navigation to {} is not allowed", url.scheme())) }
}
/// Correlation ids are made by the app: short, [A-Za-z0-9_-].
pub fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}
/// The only scripts bot_run evaluates are calls into the injected driver object.
pub fn script_ok(js: &str) -> bool {
    js.starts_with("window.__sb.") && js.len() <= 20_000 && !js.contains('\0')
}
pub fn clamp_timeout(ms: u64) -> u64 {
    ms.clamp(1_000, 120_000)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn ok(u: &str) -> bool {
        u.parse::<Url>().map(|u| nav_allowed(&u)).unwrap_or(false)
    }
    #[test]
    fn web_is_open_dangerous_schemes_are_not() {
        for u in ["https://example.com/a?b=1", "http://example.org/", "https://sub.site.co.uk:8443/x", "http://192.168.1.5/"] {
            assert!(ok(u), "{u}");
        }
        for u in ["file:///c:/x", "javascript:alert(1)", "data:text/html,hi", "blob:https://a/b", "about:blank", "tauri://localhost/", "ftp://a/b", "chrome://settings", "ws://a/"] {
            assert!(!ok(u), "{u}");
        }
    }
    #[test]
    fn app_origin_and_loopback_are_blocked() {
        for u in ["https://tauri.localhost/", "http://tauri.localhost/", "http://localhost:11434/", "http://127.0.0.1:11434/api/tags", "http://[::1]/", "https://a.localhost/", "http://0.0.0.0/", "http://LOCALHOST./"] {
            assert!(!ok(u), "{u}");
        }
    }
    #[test]
    fn parse_nav_errors_name_the_scheme_only() {
        assert!(parse_nav("https://example.com").is_ok());
        assert!(parse_nav("javascript:alert(1)").unwrap_err().contains("javascript"));
        assert!(parse_nav("nonsense").is_err());
    }
    #[test]
    fn ids_and_scripts() {
        assert!(valid_id("r-1_a") && !valid_id("") && !valid_id("a:b") && !valid_id(&"a".repeat(65)));
        assert!(script_ok("window.__sb.observe()") && !script_ok("alert(1)") && !script_ok("fetch('//x');window.__sb."));
        assert!(!script_ok(&format!("window.__sb.{}", "x".repeat(20_000))));
        assert_eq!(clamp_timeout(0), 1_000);
        assert_eq!(clamp_timeout(u64::MAX), 120_000);
    }
    fn glob(pattern: &str, label: &str) -> bool {
        pattern.strip_suffix('*').map_or(pattern == label, |p| label.starts_with(p))
    }
    #[test]
    fn bot_browser_has_no_ipc_capability() {
        let cap: serde_json::Value = serde_json::from_str(include_str!("../../capabilities/default.json")).unwrap();
        for key in ["windows", "webviews"] {
            for p in cap[key].as_array().unwrap() {
                assert!(!glob(p.as_str().unwrap(), super::super::LABEL), "{key} {p} matches the bot browser");
            }
        }
        assert!(cap.get("remote").is_none(), "no remote-URL capability");
    }
}
