//! Tray icon: tooltip carries the unread TOTAL only (never message text);
//! menu = Show, Game mode (the main window toggles it), Quit.
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

const TRAY_ID: &str = "sentinel-tray";

pub fn tooltip_text(unread: u32) -> String {
    match unread {
        0 => "Sentinel".to_string(),
        1 => "Sentinel - 1 unread".to_string(),
        n => format!("Sentinel - {n} unread"),
    }
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Sentinel", true, None::<&str>)?;
    let game = MenuItem::with_id(app, "game", "Toggle game mode", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &game, &quit])?;
    let mut b = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(tooltip_text(0))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, ev| match ev.id().as_ref() {
            "show" => super::show_main(app),
            "game" => { let _ = app.emit_to("main", "tray-game-mode", ()); }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                super::show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        b = b.icon(icon.clone());
    }
    b.build(app)?;
    Ok(())
}

#[tauri::command]
pub fn set_tray_unread(app: AppHandle, count: u32) -> Result<(), String> {
    if let Some(t) = app.tray_by_id(TRAY_ID) {
        t.set_tooltip(Some(tooltip_text(count))).map_err(|e| e.to_string())?;
    }
    let _ = app.get_webview_window("main"); // keep Manager in scope for future badge overlay
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn tooltip_counts_only() {
        assert_eq!(tooltip_text(0), "Sentinel");
        assert_eq!(tooltip_text(1), "Sentinel - 1 unread");
        assert_eq!(tooltip_text(42), "Sentinel - 42 unread");
    }
}
