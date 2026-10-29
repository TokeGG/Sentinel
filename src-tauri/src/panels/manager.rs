//! Panel webview manager (Task 7). Decision "B": every panel is a native child
//! webview of window "main"; any panel may overlap any other.
//!
//! Raise-to-front: there is no reliable cross-platform z-order API for child
//! webviews, and the overlap spike could not be run (headless Linux). So
//! `focus_panel` re-creates the child webview (close + add_child at the same
//! rect); the newest child is on top. Web panels keep their session because
//! `data_directory` is derived from the profile name, never the label.
//! Fallback ("A": web panels always on top): only `focus_panel` changes — it
//! would just call `set_focus` and never re-create.
//!
//! Chrome (Task 9b): every panel is TWO child webviews — content
//! (`label()`), a 28px chrome strip (`chrome_label()`, route
//! `#/chrome/<id>`) and a 16px bottom-right resize grip (`grip_label()`, route
//! `#/grip/<id>`), created after it so they stack on top. Every path below
//! (create/destroy/move/resize/raise/show/hide) acts on both; `Spec.rect` is
//! the OUTER rect and `geometry()` derives both webview rects from it.
//!
//! Locks (`Panels`/`Specs`) are held in short blocks, never across webview calls.
//! Persistence: commands return `SavedPanel` data; the frontend writes
//! `panel_layout` (see persist.rs header).
pub use super::ids::{label, parse_web_url, validate};
pub(crate) use super::webview::{create, destroy, set_visible};
pub(super) use super::webview::{place, place_pos};
pub use super::restore::*;
pub use super::fullwindow::*;
use super::persist::{self, Rect, SavedPanel};
use super::state::{OpenOutcome, Panels};
use super::webguard::effective_hosts;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Clone)]
pub struct Spec {
    pub(super) url: Option<String>,
    pub(super) profile: Option<String>,
    pub(super) rect: Rect,
    /// Hosts a web panel may load (see webguard.rs); empty for app panels.
    pub(super) hosts: Vec<String>,
    /// Rect to return to while in "Full window"; None = not full.
    pub(super) prev: Option<Rect>,
}
#[derive(Default)]
pub struct Specs(pub(super) Mutex<HashMap<String, Spec>>);

pub(crate) fn e(err: impl std::fmt::Display) -> String {
    err.to_string()
}
pub(crate) fn spec(specs: &Specs, id: &str) -> Result<Spec, String> {
    specs.0.lock().map_err(e)?.get(id).cloned().ok_or_else(|| format!("unknown panel {id}"))
}
pub(super) fn saved(id: &str, rect: Rect, panels: &Mutex<Panels>) -> Result<SavedPanel, String> {
    let p = panels.lock().map_err(e)?;
    let st = p.state(id).ok_or_else(|| format!("unknown panel {id}"))?;
    let z = p.z_order().iter().position(|x| x == id).unwrap_or(0) as i64;
    Ok(SavedPanel { id: id.into(), rect, state: persist::state_name(st).into(), z })
}

/// Drop state for `id` after a failed (re)create so it never reads Open without a webview.
pub(crate) fn rollback(app: &AppHandle, id: &str) {
    if let Ok(mut p) = app.state::<Mutex<Panels>>().lock() {
        p.close(id);
    }
    if let Ok(mut m) = app.state::<Specs>().0.lock() {
        m.remove(id);
    }
}

#[tauri::command]
pub async fn open_panel(app: AppHandle, id: String, url: Option<String>, profile: Option<String>, rect: Rect, hosts: Option<Vec<String>>) -> Result<(), String> {
    validate(&id, profile.as_deref())?;
    if let Some(u) = &url { parse_web_url(u)?; }
    let hosts = url.as_deref().map(|u| effective_hosts(u, hosts)).unwrap_or_default();
    let s = Spec { url, profile, rect, hosts, prev: None };
    app.state::<Specs>().0.lock().map_err(e)?.insert(id.clone(), s.clone());
    let outcome = app.state::<Mutex<Panels>>().lock().map_err(e)?.open(&id);
    if outcome == OpenOutcome::Focused && app.get_webview(&label(&id)).is_some() {
        return raise(&app, &id, &s);
    }
    create(&app, &id, &s).inspect_err(|_| rollback(&app, &id))
}

#[tauri::command]
pub async fn close_panel(app: AppHandle, id: String) -> Result<(), String> {
    rollback(&app, &id);
    destroy(&app, &id)
}

fn update_rect(specs: &Specs, id: &str, f: impl FnOnce(&mut Rect)) -> Result<Rect, String> {
    let mut m = specs.0.lock().map_err(e)?;
    let s = m.get_mut(id).ok_or_else(|| format!("unknown panel {id}"))?;
    f(&mut s.rect);
    Ok(s.rect)
}

/// Drag hot paths: sync, position-only moves, no reply payload; persisted on drag end.
#[tauri::command]
pub fn move_panel(app: AppHandle, id: String, x: f64, y: f64) -> Result<(), String> {
    let rect = update_rect(&app.state::<Specs>(), &id, |r| (r.x, r.y) = (x, y))?;
    place_pos(&app, &id, rect)
}

#[tauri::command]
pub fn resize_panel(app: AppHandle, id: String, w: f64, h: f64) -> Result<(), String> {
    let rect = update_rect(&app.state::<Specs>(), &id, |r| (r.w, r.h) = (w, h))?;
    place(&app, &id, rect)
}

/// The only function to change for fallback "A" (see header).
/// Re-creates content then chrome so the chrome stays above the content.
fn raise(app: &AppHandle, id: &str, s: &Spec) -> Result<(), String> {
    if let Err(err) = destroy(app, id) {
        rollback(app, id); // never leave Open with a half-closed pair
        return Err(err);
    }
    if let Err(err) = create(app, id, s) {
        rollback(app, id);
        return Err(err);
    }
    if let Some(w) = app.get_webview(&label(id)) {
        w.set_focus().map_err(e)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn focus_panel(app: AppHandle, id: String) -> Result<SavedPanel, String> {
    let s = spec(&app.state::<Specs>(), &id)?;
    let was_top = {
        let st = app.state::<Mutex<Panels>>();
        let mut p = st.lock().map_err(e)?;
        let top = p.is_top(&id);
        p.open(&id);
        top
    };
    // Topmost or web panel: just focus (re-create kills chrome mid-drag / a live call).
    match app.get_webview(&label(&id)) {
        Some(w) if was_top || s.url.is_some() => w.set_focus().map_err(e)?,
        _ => raise(&app, &id, &s)?,
    }
    saved(&id, s.rect, &app.state::<Mutex<Panels>>())
}

/// Current outer rect + state + z; no side effects.
#[tauri::command]
pub async fn get_panel(app: AppHandle, id: String) -> Result<SavedPanel, String> {
    let s = spec(&app.state::<Specs>(), &id)?;
    saved(&id, s.rect, &app.state::<Mutex<Panels>>())
}
