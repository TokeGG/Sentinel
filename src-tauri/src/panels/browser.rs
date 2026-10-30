//! In-app browser tabs (`hub.browser`): one child webview per tab, labelled
//! `embed-<panel>-tab<n>` so it moves/hides/closes with the panel like a Social
//! embed (webview.rs Part::Tab, rect = geometry::browser_rect). NO IPC capability
//! (labels never match capabilities/default.json). Any http(s) page may load;
//! new windows become new tabs; downloads go to the user's Downloads folder.
//! Page URL/title go only to the browser panel's own webview. Only the active
//! tab is re-created after a raise or game mode (the panel lazily re-shows others).
use super::embed::EmbedSpec;
use super::geometry::browser_rect;
use super::ids::{embed_label, is_tab_site, label, parse_web_url, validate};
use super::manager::{e, Specs};
use super::webview::{add, add_grip, webviews, Part};
use tauri::webview::{DownloadEvent, NewWindowResponse, PageLoadEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewBuilder, WebviewUrl};

fn tab_of(site: &str) -> u32 {
    site[3..].parse().unwrap_or(0)
}

pub(super) fn add_tab(app: &AppHandle, id: &str, em: &EmbedSpec, outer: super::persist::Rect) -> Result<(), String> {
    let mut b = WebviewBuilder::new(embed_label(id, &em.site), WebviewUrl::External(parse_web_url(&em.url)?));
    b = if em.private { b.incognito(true) } else { b.data_directory(app.path().app_data_dir().map_err(e)?.join("profiles").join(&em.profile)) };
    let (tab, panel, pid) = (tab_of(&em.site), label(id), id.to_string());
    let (a1, a2, a3, a4, p1, p2, p3, p4) = (app.clone(), app.clone(), app.clone(), app.clone(), panel.clone(), panel.clone(), panel.clone(), panel);
    let dl = app.path().download_dir().ok();
    if super::browser_os::DARK.load(std::sync::atomic::Ordering::Relaxed) { b = b.initialization_script(super::browser_os::DARK_JS); }
    b = b
        .on_navigation(|u| matches!(u.scheme(), "http" | "https"))
        .on_new_window(move |u, _| {
            if matches!(u.scheme(), "http" | "https") {
                let _ = a1.emit_to(p1.as_str(), "browser-new-tab", serde_json::json!({ "url": u.as_str() }));
            }
            NewWindowResponse::Deny
        })
        .on_page_load(move |w, p| {
            if p.event() == PageLoadEvent::Finished {
                let url = p.url().to_string();
                if let Some(s) = a2.state::<Specs>().0.lock().ok().as_mut().and_then(|m| m.get_mut(&pid)) {
                    if let Some(em) = s.embed.as_mut().filter(|em| embed_label(&pid, &em.site) == w.label()) {
                        em.url = url.clone(); // a raise re-opens the page the tab is on
                    }
                }
                let _ = a2.emit_to(p2.as_str(), "browser-nav", serde_json::json!({ "tab": tab, "url": url }));
            }
        })
        .on_document_title_changed(move |_, title| {
            let _ = a3.emit_to(p3.as_str(), "browser-title", serde_json::json!({ "tab": tab, "title": title }));
        })
        .on_download(move |_, ev| match ev {
            DownloadEvent::Requested { url, destination } => {
                let Some(dir) = dl.as_ref() else { return false };
                let name = super::browser_os::download_name(url.path(), destination.file_name().and_then(|n| n.to_str()));
                *destination = super::browser_os::unique_path(dir, &name);
                true
            }
            DownloadEvent::Finished { url, path, success } => {
                let _ = a4.emit_to(p4.as_str(), "browser-download", serde_json::json!({ "url": url.as_str(), "path": path, "ok": success }));
                true
            }
            _ => true,
        });
    add(app, b, browser_rect(outer))
}

fn tab_spec(app: &AppHandle, id: &str, tab: u32, url: Option<String>, private: Option<bool>) -> Result<(EmbedSpec, super::persist::Rect, bool), String> {
    let specs = app.state::<Specs>();
    let mut m = specs.0.lock().map_err(e)?;
    let s = m.get_mut(id).ok_or_else(|| format!("unknown panel {id}"))?;
    let site = format!("tab{tab}");
    let same = s.embed.as_ref().is_some_and(|em| em.site == site);
    let em = EmbedSpec { site, url: url.unwrap_or_default(), profile: "browser".into(), hosts: vec![], private: private.unwrap_or(false) };
    s.embed = Some(em.clone());
    Ok((em, s.rect, same))
}

/// Show tab `tab` (creating it at `url` on first use) and hide the panel's other tabs.
#[tauri::command]
pub async fn browser_show(app: AppHandle, id: String, tab: u32, url: String, private: Option<bool>) -> Result<(), String> {
    validate(&id, None)?;
    parse_web_url(&url)?;
    let (em, rect, _) = tab_spec(&app, &id, tab, Some(url), private)?;
    let l = embed_label(&id, &em.site);
    if app.get_webview(&l).is_none() {
        add_tab(&app, &id, &em, rect)?;
        add_grip(&app, &id, rect)?;
    }
    for (w, p) in webviews(&app, &id) {
        if p == Part::Tab {
            if w.label() == l { w.show() } else { w.hide() }.map_err(e)?;
        }
    }
    Ok(())
}

/// Hide every tab (menus / bookmarks manager drawn by the panel need the space).
#[tauri::command]
pub async fn browser_hide(app: AppHandle, id: String) -> Result<(), String> {
    for (w, p) in webviews(&app, &id) {
        if p == Part::Tab {
            w.hide().map_err(e)?;
        }
    }
    Ok(())
}

fn tab_view(app: &AppHandle, id: &str, tab: u32) -> Result<tauri::Webview, String> {
    let site = format!("tab{tab}");
    if !is_tab_site(&site) { return Err("bad tab".into()) }
    app.get_webview(&embed_label(id, &site)).ok_or_else(|| format!("no tab {tab}"))
}

/// navigate / back / forward / reload / stop on one tab.
#[tauri::command]
pub async fn browser_go(app: AppHandle, id: String, tab: u32, action: String, url: Option<String>) -> Result<(), String> {
    let w = tab_view(&app, &id, tab)?;
    match action.as_str() {
        "navigate" => w.navigate(parse_web_url(url.as_deref().unwrap_or(""))?).map_err(e),
        "back" => w.eval("history.back()").map_err(e),
        "forward" => w.eval("history.forward()").map_err(e),
        "reload" => w.eval("location.reload()").map_err(e),
        "stop" => w.eval("window.stop()").map_err(e),
        a => Err(format!("unknown action {a}")),
    }
}

#[tauri::command]
pub async fn browser_close_tab(app: AppHandle, id: String, tab: u32) -> Result<(), String> {
    if let Ok(w) = tab_view(&app, &id, tab) {
        w.close().map_err(e)?;
    }
    if let Some(s) = app.state::<Specs>().0.lock().map_err(e)?.get_mut(&id) {
        if s.embed.as_ref().is_some_and(|em| em.site == format!("tab{tab}")) {
            s.embed = None;
        }
    }
    Ok(())
}
