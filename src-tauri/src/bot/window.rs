//! The bot's own browser window: label `bot-browser`, profile dir `profiles/bot` (separate from Discord/YouTube),
//! no IPC capability, created hidden unless asked. Top-level navigation is policy-checked and logged (`bot-nav`).
use super::{policy, session, LABEL};
use tauri::webview::{DownloadEvent, NewWindowResponse, PageLoadEvent, PermissionResponse};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

pub fn get(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(LABEL)
}
pub fn build(app: &AppHandle, url: Url, visible: bool) -> Result<WebviewWindow, String> {
    let nonce = session::new_nonce(app);
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("profiles").join("bot");
    let (nav, newwin, title, load, ev) = (app.clone(), app.clone(), app.clone(), app.clone(), app.clone());
    let win = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External(url))
        .title("Sentinel bot browser")
        .inner_size(1100.0, 800.0)
        .visible(visible)
        .data_directory(dir)
        .initialization_script(super::script::init_script(&nonce))
        .on_navigation(move |u| {
            let ok = policy::nav_allowed(u);
            eprintln!("bot navigation {} {}", if ok { "allow" } else { "DENY" }, u);
            let _ = nav.emit("bot-nav", serde_json::json!({ "url": u.as_str(), "allowed": ok }));
            if ok {
                session::navigating(&nav);
            }
            ok
        })
        .on_new_window(move |u, _| {
            // target=_blank / window.open: stay in this one window (if allowed)
            if policy::nav_allowed(&u) {
                if let Some(w) = get(&newwin) {
                    let _ = w.navigate(u);
                }
            }
            NewWindowResponse::Deny
        })
        .on_download(|_, e| !matches!(e, DownloadEvent::Requested { .. }))
        .on_permission_request(|_, _| PermissionResponse::Deny)
        .on_document_title_changed(move |_, t| session::on_title(&title, &t))
        .on_page_load(move |_, p| {
            if matches!(p.event(), PageLoadEvent::Finished) {
                session::page_loaded(&load, p.url().as_str());
            }
        })
        .build()
        .map_err(|e| e.to_string())?;
    win.on_window_event(move |e| {
        if matches!(e, WindowEvent::Destroyed) {
            session::fail_all(&ev, "browser window closed");
        }
    });
    Ok(win)
}
