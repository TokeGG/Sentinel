//! Pure decisions for web panels (Discord etc.): navigation allow-list,
//! media permissions and the unread count parsed from document.title.
use tauri::webview::PermissionKind;
use tauri::Url;

/// `host` matches `pattern`: exact, or `*.example.com` = any subdomain
/// (not the bare domain). Both lower-case.
fn host_matches(pattern: &str, host: &str) -> bool {
    match pattern.strip_prefix("*.") {
        Some(base) => host.len() > base.len() + 1 && host.ends_with(base) && host[..host.len() - base.len()].ends_with('.'),
        None => pattern == host,
    }
}
/// Hosts a web panel may load: its manifest list, or just the start URL's host.
pub fn effective_hosts(start: &str, hosts: Option<Vec<String>>) -> Vec<String> {
    let given: Vec<String> = hosts.unwrap_or_default().into_iter().map(|h| h.to_ascii_lowercase()).collect();
    if !given.is_empty() {
        return given;
    }
    start.parse::<Url>().ok().and_then(|u| u.host_str().map(|h| vec![h.to_ascii_lowercase()])).unwrap_or_default()
}
/// May the panel itself navigate to / hold `url`? https only, default port,
/// no credentials, host on the list. The app origin is never allowed.
pub fn allowed_host(allow: &[String], url: &Url) -> bool {
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    if url.port().is_some_and(|p| p != 443) {
        return false;
    }
    let Some(host) = url.host_str().map(|h| h.to_ascii_lowercase()) else { return false };
    if host == "localhost" || host.ends_with(".localhost") || host.ends_with("tauri.localhost") {
        return false;
    }
    allow.iter().any(|p| host_matches(p, &host))
}
/// Grant only microphone, camera and screen capture, and only to an allow-listed page.
pub fn permission_granted(kind: PermissionKind, allow: &[String], page: &Url) -> bool {
    matches!(kind, PermissionKind::Microphone | PermissionKind::Camera | PermissionKind::DisplayCapture)
        && allowed_host(allow, page)
}
/// Unread count from a title like "(3) Discord" or "• Discord"; 0 if none.
/// Returns the number only, never any title text.
pub fn unread_from_title(title: &str) -> u32 {
    let t = title.trim_start();
    if let Some(rest) = t.strip_prefix('(') {
        let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
        if !digits.is_empty() && rest[digits.len()..].starts_with(')') {
            return digits.parse().unwrap_or(999).min(999);
        }
        return 0;
    }
    u32::from(t.starts_with('•') || t.starts_with('●'))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn discord() -> Vec<String> {
        ["discord.com", "*.discord.com", "discord.gg", "*.discordapp.com", "*.discordapp.net"].map(String::from).to_vec()
    }
    fn ok(u: &str) -> bool {
        allowed_host(&discord(), &u.parse().unwrap())
    }
    #[test]
    fn allows_discord_hosts() {
        for u in ["https://discord.com/app", "https://ptb.discord.com/x", "https://discord.gg/abc", "https://cdn.discordapp.com/a", "https://media.discordapp.net/a", "https://DISCORD.com/"] {
            assert!(ok(u), "{u}");
        }
    }
    #[test]
    fn blocks_everything_else() {
        for u in [
            "http://discord.com/", "https://evil.com/", "https://discord.com.evil.com/", "https://notdiscord.com/",
            "https://evildiscord.com/", "https://discordapp.com/", "https://user:pw@discord.com/", "https://discord.com:8443/",
            "https://tauri.localhost/", "http://tauri.localhost/", "tauri://localhost/", "file:///c:/x", "data:text/html,hi",
            "about:blank", "javascript:alert(1)", "https://localhost/", "https://127.0.0.1/",
        ] {
            assert!(!ok(u), "{u}");
        }
    }
    #[test]
    fn app_origin_never_allowed_even_if_listed() {
        let l = vec!["tauri.localhost".to_string(), "*.localhost".to_string()];
        assert!(!allowed_host(&l, &"https://tauri.localhost/".parse().unwrap()));
    }
    #[test]
    fn default_hosts_are_the_start_host() {
        assert_eq!(effective_hosts("https://Example.com/a", None), vec!["example.com"]);
        assert_eq!(effective_hosts("https://x.com", Some(vec![])), vec!["x.com"]);
        assert_eq!(effective_hosts("https://x.com", Some(vec!["A.com".into()])), vec!["a.com"]);
    }
    #[test]
    fn permissions_only_media_on_allowed_pages() {
        let d = discord();
        let good: Url = "https://discord.com/channels/1".parse().unwrap();
        let bad: Url = "https://evil.com/".parse().unwrap();
        for k in [PermissionKind::Microphone, PermissionKind::Camera, PermissionKind::DisplayCapture] {
            assert!(permission_granted(k, &d, &good));
            assert!(!permission_granted(k, &d, &bad));
        }
        for k in [PermissionKind::Geolocation, PermissionKind::Notifications, PermissionKind::ClipboardRead] {
            assert!(!permission_granted(k, &d, &good));
        }
    }
    #[test]
    fn unread_titles() {
        for (t, n) in [("(3) Discord", 3), ("(12) Discord", 12), ("• Discord", 1), ("● Discord", 1), ("Discord", 0), ("", 0),
            ("(x) Discord", 0), ("(3 Discord", 0), ("(99999999999) D", 999), ("(1500) D", 999), ("Hi (3)", 0)] {
            assert_eq!(unread_from_title(t), n, "{t}");
        }
    }
}
