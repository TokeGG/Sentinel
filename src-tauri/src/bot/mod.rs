//! Browser driver for the Bot module: one dedicated window (`bot-browser`, own profile, no IPC capability).
//! Commands return at once; every result arrives as a `bot-result` event {id, ok, json} (see session.rs).
//! The page answers through chunked document.title messages (chunk.rs, driver.js) because eval returns nothing.
mod chunk;
mod policy;
mod script;
mod session;
mod window;

pub use session::BotBrowser;
use tauri::{AppHandle, Emitter};

pub const LABEL: &str = "bot-browser";
const E: fn(tauri::Error) -> String = |e| e.to_string();

fn check_id(id: &str) -> Result<(), String> {
    if policy::valid_id(id) { Ok(()) } else { Err("invalid command id".into()) }
}

/// Open (or reuse) the bot window at `url`; completes when the page has loaded.
#[tauri::command]
pub async fn bot_open(app: AppHandle, id: String, url: String, visible: bool, timeout_ms: u64) -> Result<(), String> {
    check_id(&id)?;
    let url = policy::parse_nav(&url)?;
    session::expect(&app, &id, true, policy::clamp_timeout(timeout_ms));
    let r = match window::get(&app) {
        Some(w) => w.navigate(url).and_then(|_| if visible { w.show() } else { w.hide() }).map_err(E),
        None => window::build(&app, url, visible).map(|_| ()),
    };
    if let Err(e) = &r {
        session::complete(&app, &id, false, serde_json::json!(e).to_string());
    }
    r
}

#[tauri::command]
pub async fn bot_navigate(app: AppHandle, id: String, url: String, timeout_ms: u64) -> Result<(), String> {
    check_id(&id)?;
    let url = policy::parse_nav(&url)?;
    let w = window::get(&app).ok_or("bot browser is not open")?;
    session::expect(&app, &id, true, policy::clamp_timeout(timeout_ms));
    w.navigate(url).map_err(E)
}

/// Evaluate a `window.__sb.*` call in the page; the value comes back as `bot-result`.
#[tauri::command]
pub async fn bot_run(app: AppHandle, script_id: String, js: String, timeout_ms: u64) -> Result<(), String> {
    check_id(&script_id)?;
    if !policy::script_ok(&js) {
        return Err("only window.__sb calls may run".into());
    }
    let w = window::get(&app).ok_or("bot browser is not open")?;
    session::expect(&app, &script_id, false, policy::clamp_timeout(timeout_ms));
    w.eval(script::run_script(&script_id, &js)).map_err(E)
}

#[tauri::command]
pub async fn bot_show(app: AppHandle, visible: bool) -> Result<(), String> {
    let w = window::get(&app).ok_or("bot browser is not open")?;
    if visible { w.show() } else { w.hide() }.map_err(E)
}

#[tauri::command]
pub async fn bot_close(app: AppHandle) -> Result<(), String> {
    stop(&app, "closed");
    Ok(())
}

/// Close the window and fail anything waiting. Called on bot_close, game mode start and app exit.
pub fn stop(app: &AppHandle, why: &str) {
    session::fail_all(app, why);
    if let Some(w) = window::get(app) {
        let _ = w.destroy();
        let _ = app.emit("bot-stopped", why);
    }
}
