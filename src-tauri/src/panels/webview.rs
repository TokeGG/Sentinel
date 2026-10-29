//! Webview pair handling for one panel (Task 9b): content (`label()`) +
//! chrome strip (`chrome_label()`), always created, placed, shown, hidden
//! and closed together. Pure split of the outer rect lives in geometry.rs.
use super::geometry::{geometry, grip_rect};
use super::ids::{chrome_label, grip_label, label, parse_web_url};
use super::manager::{e, Spec};
use super::persist::Rect;
use super::webguard::{allowed_host, permission_granted, unread_from_title};
use tauri::webview::{NewWindowResponse, PermissionResponse};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};

fn add(app: &AppHandle, b: WebviewBuilder<tauri::Wry>, r: Rect) -> Result<(), String> {
    let win = app.get_window("main").ok_or("main window missing")?;
    win.add_child(b, LogicalPosition::new(r.x, r.y), LogicalSize::new(r.w, r.h)).map_err(e)?;
    Ok(())
}
/// Create content then chrome (chrome last = on top). On any failure both
/// webviews are closed; callers still `rollback()` the state.
pub(crate) fn create(app: &AppHandle, id: &str, s: &Spec) -> Result<(), String> {
    let r = create_both(app, id, s);
    if r.is_err() {
        let _ = destroy(app, id);
    }
    r
}
fn create_both(app: &AppHandle, id: &str, s: &Spec) -> Result<(), String> {
    let url = match &s.url {
        Some(u) => WebviewUrl::External(parse_web_url(u)?),
        None => WebviewUrl::App(format!("index.html#/panel/{id}").into()),
    };
    let mut b = WebviewBuilder::new(label(id), url);
    if let Some(p) = &s.profile {
        // `p` already passed is_safe_profile in validate().
        b = b.data_directory(app.path().app_data_dir().map_err(e)?.join("profiles").join(p));
    }
    if s.url.is_some() {
        b = guard(b, app, id, &s.hosts);
    }
    let (chrome, content) = geometry(s.rect);
    add(app, b, content)?;
    // Transparent so the strip can paint rounded top corners.
    let cb = WebviewBuilder::new(chrome_label(id), WebviewUrl::App(format!("index.html#/chrome/{id}").into())).transparent(true);
    add(app, cb, chrome)?;
    // Grip last = topmost: a small overlay in the bottom-right corner of the content.
    let gb = WebviewBuilder::new(grip_label(id), WebviewUrl::App(format!("index.html#/grip/{id}").into()));
    add(app, gb, grip_rect(s.rect))
}
/// Web panel guards: https allow-list navigation (other links go to the
/// system browser), media permissions for allowed pages only, and the unread
/// count from the page title as a `planet-badge` event (count only).
fn guard(b: WebviewBuilder<tauri::Wry>, app: &AppHandle, id: &str, hosts: &[String]) -> WebviewBuilder<tauri::Wry> {
    let (h1, h2, a1, a2, id) = (hosts.to_vec(), hosts.to_vec(), app.clone(), app.clone(), id.to_string());
    b.on_navigation(move |u| allowed_host(&h1, u) || external(&a1, u))
        .on_new_window(move |u, _| {
            external(&a2, &u);
            NewWindowResponse::Deny
        })
        .on_permission_request(move |w, kind| match w.url() {
            Ok(page) if permission_granted(kind, &h2, &page) => PermissionResponse::Allow,
            _ => PermissionResponse::Deny,
        })
        .on_document_title_changed(move |w, title| {
            let _ = w.app_handle().emit("planet-badge", serde_json::json!({ "id": id, "count": unread_from_title(&title) }));
        })
}
/// Open an http(s) link in the system browser; always returns false (block in panel).
fn external(app: &AppHandle, u: &tauri::Url) -> bool {
    if matches!(u.scheme(), "http" | "https") {
        let _ = tauri_plugin_opener::OpenerExt::opener(app).open_url(u.as_str(), None::<&str>);
    }
    false
}
#[derive(Clone, Copy, PartialEq)]
pub(crate) enum Part {
    Content,
    Chrome,
    Grip,
}
/// The webviews of a panel that currently exist.
pub(crate) fn webviews(app: &AppHandle, id: &str) -> Vec<(tauri::Webview, Part)> {
    [(label(id), Part::Content), (chrome_label(id), Part::Chrome), (grip_label(id), Part::Grip)]
        .into_iter()
        .filter_map(|(l, p)| app.get_webview(&l).map(|w| (w, p)))
        .collect()
}
/// Close all webviews; tries all even if the first fails.
pub(crate) fn destroy(app: &AppHandle, id: &str) -> Result<(), String> {
    let mut first = Ok(());
    for (w, _) in webviews(app, id) {
        if let Err(err) = w.close() {
            first = first.and(Err(e(err)));
        }
    }
    first
}
/// Show (true) or hide (false) all webviews.
pub(crate) fn set_visible(app: &AppHandle, id: &str, visible: bool) -> Result<(), String> {
    for (w, _) in webviews(app, id) {
        let r = if visible { w.show() } else { w.hide() };
        r.map_err(e)?;
    }
    Ok(())
}
fn part_rect(outer: Rect, p: Part) -> Rect {
    let (chrome, content) = geometry(outer);
    match p {
        Part::Content => content,
        Part::Chrome => chrome,
        Part::Grip => grip_rect(outer),
    }
}
/// Re-apply the geometry of `outer` to every webview (position + size).
pub(super) fn place(app: &AppHandle, id: &str, outer: Rect) -> Result<(), String> {
    for (w, p) in webviews(app, id) {
        let r = part_rect(outer, p);
        w.set_position(LogicalPosition::new(r.x, r.y)).map_err(e)?;
        w.set_size(LogicalSize::new(r.w, r.h)).map_err(e)?;
    }
    Ok(())
}
/// Drag hot path: sizes are unchanged, so only reposition (no size, no allocation of rects beyond the stack).
pub(super) fn place_pos(app: &AppHandle, id: &str, outer: Rect) -> Result<(), String> {
    for (w, p) in webviews(app, id) {
        let r = part_rect(outer, p);
        w.set_position(LogicalPosition::new(r.x, r.y)).map_err(e)?;
    }
    Ok(())
}
