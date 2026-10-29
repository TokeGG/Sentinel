//! Embedded site views inside a custom panel's body (Social tabs X/Facebook/Instagram).
//! Each is a child webview `embed-<panel>-<site>` (own profile dir, same guards as web
//! panels, NO IPC: the capability patterns do not match `embed-*`), placed at
//! `embed_rect(panel rect)` and moved/resized/hidden/closed with the panel (webview.rs).
//! Only the active one is visible; the others are hidden, not destroyed, so logins and
//! scroll persist. A raise (re-create) or game mode keeps only the active one.
use super::geometry::embed_rect;
use super::ids::{embed_label, is_valid_site, parse_web_url, validate};
use super::manager::{e, Specs};
use super::webguard::effective_hosts;
use super::webview::{add, add_grip, guard, webviews, Part};
use tauri::{AppHandle, Manager};

#[derive(Clone)]
pub struct EmbedSpec {
    pub(super) site: String,
    pub(super) url: String,
    pub(super) profile: String,
    pub(super) hosts: Vec<String>,
}

/// Create the embed's webview (profile data dir by name, never the label).
pub(super) fn add_embed(app: &AppHandle, id: &str, em: &EmbedSpec, outer: super::persist::Rect) -> Result<(), String> {
    let b = tauri::WebviewBuilder::new(embed_label(id, &em.site), tauri::WebviewUrl::External(parse_web_url(&em.url)?))
        .data_directory(app.path().app_data_dir().map_err(e)?.join("profiles").join(&em.profile));
    add(app, guard(b, app, id, &em.hosts, false), embed_rect(outer))
}

/// Show `site`'s view (creating it on first use) and hide the panel's other embeds.
#[tauri::command]
pub async fn embed_show(app: AppHandle, id: String, site: String, url: String, profile: String, hosts: Option<Vec<String>>) -> Result<(), String> {
    validate(&id, Some(&profile))?;
    if !is_valid_site(&site) {
        return Err(format!("invalid site {site:?}"));
    }
    parse_web_url(&url)?;
    let em = EmbedSpec { site, hosts: effective_hosts(&url, hosts), url, profile };
    let s = {
        let specs = app.state::<Specs>();
        let mut m = specs.0.lock().map_err(e)?;
        let s = m.get_mut(&id).ok_or_else(|| format!("unknown panel {id}"))?;
        s.embed = Some(em.clone());
        s.clone()
    };
    let label = embed_label(&id, &em.site);
    if app.get_webview(&label).is_none() {
        add_embed(&app, &id, &em, s.rect)?;
        add_grip(&app, &id, s.rect)?; // the grip must stay above the new view
    }
    for (w, p) in webviews(&app, &id) {
        if p == Part::Embed {
            if w.label() == label { w.show() } else { w.hide() }.map_err(e)?;
        }
    }
    Ok(())
}

/// Feed tab: hide every embed of the panel (kept alive).
#[tauri::command]
pub async fn embed_hide(app: AppHandle, id: String) -> Result<(), String> {
    if let Some(s) = app.state::<Specs>().0.lock().map_err(e)?.get_mut(&id) {
        s.embed = None;
    }
    for (w, p) in webviews(&app, &id) {
        if p == Part::Embed {
            w.hide().map_err(e)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::ids::embed_label;
    fn glob(pattern: &str, label: &str) -> bool {
        pattern.strip_suffix('*').map_or(pattern == label, |p| label.starts_with(p))
    }
    #[test]
    fn embeds_have_no_ipc_capability() {
        let cap: serde_json::Value = serde_json::from_str(include_str!("../../capabilities/default.json")).unwrap();
        for site in ["x", "facebook", "instagram"] {
            let l = embed_label("hub.social", site);
            for key in ["windows", "webviews"] {
                for p in cap[key].as_array().unwrap() {
                    assert!(!glob(p.as_str().unwrap(), &l), "{key} {p} matches {l}");
                }
            }
        }
        assert!(cap.get("remote").is_none(), "no remote-URL capability");
    }
}
