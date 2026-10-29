//! Game mode (Task 8): while a game runs, destroy every panel webview except
//! the kept ones (suspended + hidden), and tell the frontend via the
//! `game-mode` event so it can pause scheduler timers (listener: Task 9).
//!
//! GPU load: there is no cheap portable GPU-utilisation source (sysinfo has
//! none; NVML/D3DKMT are vendor/Windows specific), so the poll passes 0.0.
//! Detection is therefore manual toggle + fullscreen foreground window only.
use crate::panels::manager::{create, destroy, e, resume_panels, rollback, set_visible, spec, Specs};
use crate::panels::state::Panels;
mod decide;
mod fullscreen;
use decide::{decide, transition, Transition};
use fullscreen::fullscreen_foreground;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// Panels kept (suspended, not destroyed) during game mode.
pub const KEEP: [&str; 2] = ["hub.discord", "hub.chat"];
const POLL: Duration = Duration::from_secs(5);

#[derive(Default)]
pub struct GameMode(Mutex<Flags>);
#[derive(Default)]
/// `auto` defaults to false. CONTRACT (Task 9): the frontend persists a
/// `game_mode_auto` setting in SQLite (default ON, the user's choice) and calls
/// `set_game_mode_auto` at startup and whenever it is toggled. Rust never reads SQL.
struct Flags {
    manual: bool,
    auto: bool,
    active: bool,
}

#[derive(Clone, serde::Serialize)]
struct Payload {
    active: bool,
}

/// Re-evaluate; on a transition update panels/webviews. Always emits
/// `game-mode`; a failure also emits `game-mode-error` (message string).
async fn evaluate(app: &AppHandle, manual: Option<bool>, auto: Option<bool>) -> Result<(), String> {
    let gm = app.state::<GameMode>();
    let auto_on = {
        let mut f = gm.0.lock().map_err(e)?;
        if let Some(m) = manual {
            f.manual = m;
        }
        if let Some(a) = auto {
            f.auto = a;
        }
        f.auto
    };
    // No Win32 work at all unless the user opted in to auto-detection.
    let fullscreen = auto_on && fullscreen_foreground();
    let (t, active) = {
        let mut f = gm.0.lock().map_err(e)?;
        let t = transition(f.active, decide(f.auto, fullscreen, f.manual));
        if t.is_some() {
            f.active = !f.active;
        }
        (t, f.active)
    };
    let r = match t {
        Some(Transition::Enter) => enter(app),
        Some(Transition::Exit) => exit(app),
        None => Ok(()),
    };
    let emitted = app.emit("game-mode", Payload { active }).map_err(e);
    if let Err(err) = &r {
        eprintln!("game mode: {err}");
        let _ = app.emit("game-mode-error", err.clone());
    }
    r.and(emitted)
}

/// Best-effort: keeps going after a failure, returns the first error.
fn enter(app: &AppHandle) -> Result<(), String> {
    crate::commands::mcp::stop_all(app); // MCP servers never run through game mode
    let gone = app.state::<Mutex<Panels>>().lock().map_err(e)?.enter_game_mode(&KEEP);
    let mut first_err = None;
    for id in &gone {
        // spec (url/profile/rect) stays in Specs for exit; closes content + chrome
        if let Err(err) = destroy(app, id) {
            first_err.get_or_insert(format!("destroy {id}: {err}"));
        }
    }
    for id in KEEP {
        // hides content AND chrome
        if let Err(err) = set_visible(app, id, false) {
            first_err.get_or_insert(format!("hide {id}: {err}"));
        }
    }
    first_err.map_or(Ok(()), Err)
}

fn exit(app: &AppHandle) -> Result<(), String> {
    let restore = app.state::<Mutex<Panels>>().lock().map_err(e)?.exit_game_mode();
    let mut first_err = None;
    for id in &restore {
        let r = spec(&app.state::<Specs>(), id).and_then(|s| create(app, id, &s));
        if let Err(err) = r {
            rollback(app, id); // never leave Open without a webview
            first_err.get_or_insert(format!("restore {id}: {err}"));
        }
    }
    let keep: Vec<String> = KEEP.iter().map(|s| s.to_string()).collect();
    if let Err(err) = resume_panels(app, &keep) {
        first_err.get_or_insert(format!("resume kept: {err}"));
    }
    first_err.map_or(Ok(()), Err)
}

#[tauri::command]
pub async fn set_game_mode(app: AppHandle, manual: bool) -> Result<(), String> {
    evaluate(&app, Some(manual), None).await
}

#[tauri::command]
pub async fn set_game_mode_auto(app: AppHandle, enabled: bool) -> Result<(), String> {
    evaluate(&app, None, Some(enabled)).await
}

/// Started from `setup()`; runs only while the app runs.
pub fn start_poll(app: AppHandle) {
    // Own OS thread so the sleep never blocks an async runtime worker.
    std::thread::spawn(move || loop {
        std::thread::sleep(POLL);
        // Errors are already logged and emitted as `game-mode-error`.
        let _ = tauri::async_runtime::block_on(evaluate(&app, None, None));
    });
}
