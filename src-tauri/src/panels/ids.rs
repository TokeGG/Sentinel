//! Pure id/label/url helpers for panels (split out of manager.rs, Task 9b).
use super::state::is_safe_profile;

/// Module ids are reverse-DNS: 1..=64 chars of [a-z0-9.-].
pub fn is_valid_panel_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'.' || c == b'-')
}
/// Webview labels disallow '.', ids disallow '_', so this mapping is injective.
pub fn label(id: &str) -> String {
    format!("panel-{}", id.replace('.', "_"))
}
/// Label of the panel's chrome-strip webview; injective like `label()`.
pub fn chrome_label(id: &str) -> String {
    format!("chrome-{}", id.replace('.', "_"))
}
/// Label of the panel's bottom-right resize-grip webview; injective like `label()`.
pub fn grip_label(id: &str) -> String {
    format!("grip-{}", id.replace('.', "_"))
}
/// Label of an embedded site view inside panel `id`: `embed-<panel>-<site>`. Sites have no '-'
/// ([a-z0-9]{1,16}), so the last '-' splits it unambiguously.
pub fn embed_label(id: &str, site: &str) -> String {
    format!("embed-{}-{site}", id.replace('.', "_"))
}
pub fn is_valid_site(s: &str) -> bool {
    !s.is_empty() && s.len() <= 16 && s.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}
/// Browser tab embeds use the site name `tab<n>` (no Social site starts with "tab").
pub fn is_tab_site(s: &str) -> bool {
    s.strip_prefix("tab").is_some_and(|d| !d.is_empty() && d.len() <= 9 && d.bytes().all(|c| c.is_ascii_digit()))
}
/// Is this webview label a browser tab (`embed-<panel>-tab<n>`)?
pub fn is_tab_label(label: &str) -> bool {
    label.starts_with("embed-") && label.rsplit_once('-').is_some_and(|(_, s)| is_tab_site(s))
}
/// Does webview `label` belong to panel `id`'s embeds?
pub fn embed_of(label: &str, id: &str) -> bool {
    label.strip_prefix("embed-").and_then(|r| r.rsplit_once('-')).is_some_and(|(own, site)| own == id.replace('.', "_") && is_valid_site(site))
}
/// Only http/https URLs may be loaded into a web panel.
pub fn parse_web_url(u: &str) -> Result<tauri::Url, String> {
    let url: tauri::Url = u.parse().map_err(|e| format!("{e}"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        s => Err(format!("disallowed url scheme {s:?}")),
    }
}
pub fn validate(id: &str, profile: Option<&str>) -> Result<(), String> {
    if !is_valid_panel_id(id) {
        return Err(format!("invalid panel id {id:?}"));
    }
    match profile {
        Some(p) if !is_safe_profile(p) => Err(format!("invalid profile {p:?}")),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn panel_ids_validated() {
        for ok in ["hub.notes", "a", "x-1.y"] {
            assert!(is_valid_panel_id(ok), "{ok}");
        }
        for bad in ["", "Hub", "a/b", "a_b", "a b", "..\\x"] {
            assert!(!is_valid_panel_id(bad), "{bad}");
        }
        assert!(is_valid_panel_id(&"a".repeat(64)));
        assert!(!is_valid_panel_id(&"a".repeat(65)));
    }
    #[test]
    fn validate_rejects_bad_profile_before_anything() {
        assert!(validate("hub.web", Some("../evil")).is_err());
        assert!(validate("../x", None).is_err());
        assert!(validate("hub.web", Some("discord")).is_ok());
    }
    #[test]
    fn web_urls_limited_to_http_https() {
        for bad in ["file:///etc/passwd", "data:text/html,x", "javascript:1", "not a url"] {
            assert!(parse_web_url(bad).is_err(), "{bad}");
        }
        assert!(parse_web_url("https://discord.com/app").is_ok());
        assert!(parse_web_url("http://localhost:8080/").is_ok());
    }
    #[test]
    fn labels_are_injective_and_dot_free() {
        assert_eq!(label("hub.notes"), "panel-hub_notes");
        assert_ne!(label("a.b"), label("a-b"));
    }
    #[test]
    fn chrome_labels_are_injective_and_distinct_from_content() {
        assert_eq!(chrome_label("hub.notes"), "chrome-hub_notes");
        assert_ne!(chrome_label("a.b"), chrome_label("a-b"));
        assert_ne!(chrome_label("hub.notes"), label("hub.notes"));
    }
    #[test]
    fn tab_sites() {
        assert!(is_tab_site("tab1") && is_tab_site("tab123"));
        assert!(!is_tab_site("tab") && !is_tab_site("x") && !is_tab_site("tabx") && !is_tab_site("instagram"));
        assert!(is_tab_label(&embed_label("hub.browser", "tab4")) && !is_tab_label(&embed_label("hub.social", "x")));
    }
    #[test]
    fn embed_labels_belong_to_exactly_one_panel() {
        let l = embed_label("hub.social", "x");
        assert_eq!(l, "embed-hub_social-x");
        assert!(embed_of(&l, "hub.social"));
        assert!(!embed_of(&l, "hub.soc") && !embed_of(&l, "hub-social-x") && !embed_of(&l, "hub"));
        // "a" must not claim an embed of "a-b"
        assert!(!embed_of(&embed_label("a-b", "x"), "a") && embed_of(&embed_label("a-b", "x"), "a-b"));
        assert!(!embed_of("panel-hub_social", "hub.social"));
        assert!(is_valid_site("x") && !is_valid_site("") && !is_valid_site("a-b") && !is_valid_site("A"));
    }
}
