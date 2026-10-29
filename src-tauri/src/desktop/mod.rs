//! Desktop integration: tray icon (unread total + quick actions), opt-in global
//! hotkeys (summon/hide, quick capture) and a plain text-file read for import.
//! Nothing here starts background work: the tray only reacts to clicks and the
//! hotkeys stay unregistered until the frontend passes a non-empty accelerator.
pub mod hotkeys;
pub mod io;
pub mod tray;

use tauri::{AppHandle, Manager};

/// Show + focus the main window (from tray "Show" or the summon hotkey).
pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Summon hotkey: hide when visible and focused, otherwise bring to front.
pub fn toggle_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let vis = w.is_visible().unwrap_or(false);
        let foc = w.is_focused().unwrap_or(false);
        if vis && foc && !w.is_minimized().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_main(app);
        }
    }
}
