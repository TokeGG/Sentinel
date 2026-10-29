//! Shared state of the bot browser: the session nonce, partial title messages and the commands still waiting
//! for a result. Every command ends in exactly one `bot-result` event {id, ok, json} (result, error or timeout).
use super::chunk::{self, Reassembler};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Default)]
pub struct BotBrowser(Mutex<Inner>);
#[derive(Default)]
struct Inner {
    nonce: String,
    asm: Reassembler,
    /// command id -> completes on the next finished page load (navigations, and actions that navigated)
    pending: HashMap<String, bool>,
}
#[derive(Clone, serde::Serialize)]
struct Result_ {
    id: String,
    ok: bool,
    json: String,
}

fn with<T>(app: &AppHandle, f: impl FnOnce(&mut Inner) -> T) -> Option<T> {
    app.state::<BotBrowser>().0.lock().ok().map(|mut g| f(&mut g))
}
/// Fresh nonce for a new window (RandomState is seeded per process; time makes it differ per window).
pub fn new_nonce(app: &AppHandle) -> String {
    use std::hash::{BuildHasher, Hasher};
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_nanos()));
    let n = format!("{:016x}", h.finish());
    with(app, |i| i.nonce = n.clone());
    n
}
/// Register a command before it is sent. `nav`: it completes when the page finishes loading.
pub fn expect(app: &AppHandle, id: &str, nav: bool, timeout_ms: u64) {
    with(app, |i| i.pending.insert(id.to_string(), nav));
    let (app, id) = (app.clone(), id.to_string());
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(timeout_ms));
        complete(&app, &id, false, "\"timeout\"".into());
    });
}
pub fn complete(app: &AppHandle, id: &str, ok: bool, json: String) {
    if with(app, |i| { i.asm.forget(id); i.pending.remove(id).is_some() }) == Some(true) {
        let _ = app.emit("bot-result", Result_ { id: id.to_string(), ok, json });
    }
}
/// Fail everything still waiting (window closed or stopped).
pub fn fail_all(app: &AppHandle, why: &str) {
    let ids: Vec<String> = with(app, |i| i.pending.keys().cloned().collect()).unwrap_or_default();
    for id in ids {
        complete(app, &id, false, serde_json::json!(why).to_string());
    }
}
/// A top-level navigation started: actions waiting for a result will not get one from the old page.
pub fn navigating(app: &AppHandle) {
    with(app, |i| i.pending.values_mut().for_each(|n| *n = true));
}
pub fn page_loaded(app: &AppHandle, url: &str) {
    let ids: Vec<String> = with(app, |i| i.pending.iter().filter(|(_, n)| **n).map(|(k, _)| k.clone()).collect()).unwrap_or_default();
    for id in ids {
        complete(app, &id, true, serde_json::json!({ "url": url, "navigated": true }).to_string());
    }
}
/// document.title changed: if it is one of our chunks, feed it; a finished message completes its command.
pub fn on_title(app: &AppHandle, title: &str) {
    let done = with(app, |i| {
        let c = chunk::decode(&i.nonce, title)?;
        let id = c.id.clone();
        i.asm.push(c).map(|r| (id, r))
    })
    .flatten();
    let Some((id, r)) = done else { return };
    let parsed = r.and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).map_err(|e| e.to_string()));
    match parsed {
        Ok(v) => complete(app, &id, v["ok"] == true, v["v"].to_string()),
        Err(e) => complete(app, &id, false, serde_json::json!(e).to_string()),
    }
}
