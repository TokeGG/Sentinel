//! Opt-in global hotkeys. The frontend passes the saved accelerators (empty =
//! off); we unregister ours and register only the non-empty ones.
use std::str::FromStr;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Default)]
pub struct Hotkeys(pub Mutex<Bound>);
#[derive(Default, Clone)]
pub struct Bound {
    pub summon: Option<Shortcut>,
    pub capture: Option<Shortcut>,
}

/// "" / whitespace = off; otherwise must parse as an accelerator.
pub fn parse(s: &str) -> Result<Option<Shortcut>, String> {
    let t = s.trim();
    if t.is_empty() {
        return Ok(None);
    }
    Shortcut::from_str(t).map(Some).map_err(|e| format!("bad hotkey \"{t}\": {e}"))
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, sc, ev| {
            if ev.state() != ShortcutState::Pressed {
                return;
            }
            let b = app.state::<Hotkeys>().0.lock().map(|g| g.clone()).unwrap_or_default();
            if b.summon.as_ref() == Some(sc) {
                super::toggle_main(app);
            } else if b.capture.as_ref() == Some(sc) {
                super::show_main(app);
                let _ = app.emit_to("main", "quick-capture", ());
            }
        })
        .build()
}

#[tauri::command]
pub fn set_hotkeys(app: AppHandle, summon: String, capture: String) -> Result<(), String> {
    let next = Bound { summon: parse(&summon)?, capture: parse(&capture)? };
    if next.summon.is_some() && next.summon == next.capture {
        return Err("summon and capture hotkeys must differ".into());
    }
    let gs = app.global_shortcut();
    let state = app.state::<Hotkeys>();
    let mut cur = state.0.lock().map_err(|e| e.to_string())?;
    for old in [cur.summon, cur.capture].into_iter().flatten() {
        let _ = gs.unregister(old);
    }
    *cur = Bound::default();
    for sc in [next.summon, next.capture].into_iter().flatten() {
        gs.register(sc).map_err(|e| format!("could not register hotkey: {e}"))?;
    }
    *cur = next;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn empty_is_off_and_bad_is_error() {
        assert!(parse("  ").unwrap().is_none());
        assert!(parse("Ctrl+Shift+Space").unwrap().is_some());
        assert!(parse("Ctrl+NotAKey").is_err());
    }
}
