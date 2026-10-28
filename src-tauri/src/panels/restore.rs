//! Layout restore and resume helpers split out of manager.rs (size rule).
use super::manager::{e, set_visible};
use super::persist::{self, LayoutRow, Rect, SavedPanel};
use super::state::Panels;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// Frontend passes the `panel_layout` rows and the usable screen rect.
#[tauri::command]
pub fn restore_layout(rows: Vec<LayoutRow>, screen: Rect) -> Vec<SavedPanel> {
    persist::restore(&rows, screen)
}

/// Resume panels left Suspended (e.g. kept through game mode). Task 8 calls it.
pub fn resume_panels(app: &AppHandle, ids: &[String]) -> Result<Vec<String>, String> {
    let resumed = app.state::<Mutex<Panels>>().lock().map_err(e)?.resume(ids);
    for id in &resumed {
        set_visible(app, id, true)?;
    }
    Ok(resumed)
}
