//! "Full window" toggle for web panels (split out of manager.rs, size rule).
use super::geometry::toggle_full;
use super::manager::{e, place, saved, Specs};
use super::persist::{Rect, SavedPanel};
use super::state::Panels;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// Web panels: maximize to `screen` (the main window client area), or restore
/// the previous rect. Returns the panel and whether it is now full window.
#[tauri::command]
pub async fn toggle_full_window(app: AppHandle, id: String, screen: Rect) -> Result<(SavedPanel, bool), String> {
    let (rect, full) = {
        let specs = app.state::<Specs>();
        let mut m = specs.0.lock().map_err(e)?;
        let s = m.get_mut(&id).ok_or_else(|| format!("unknown panel {id}"))?;
        let (r, prev) = toggle_full(s.rect, s.prev, screen);
        (s.rect, s.prev) = (r, prev);
        (r, prev.is_some())
    };
    place(&app, &id, rect)?;
    Ok((saved(&id, rect, &app.state::<Mutex<Panels>>())?, full))
}
