// MCP client commands. A server runs only after the user flips it on (mcp_start)
// and is dropped (process killed) on mcp_stop, on app exit and when game mode
// starts. Nothing here starts a server by itself.
use super::mcp_proc::{build_env, resolve, Server};
use super::skills_fs::{install_dir, valid_id};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

type Shared = Arc<Mutex<Server>>;
#[derive(Default)]
pub struct Mcp(Mutex<HashMap<String, Shared>>);

#[derive(Deserialize)]
pub struct StartSpec {
    pub id: String,
    pub command: String,
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub secret_names: Vec<String>,
}

fn valid_env_name(n: &str) -> bool {
    !n.is_empty() && n.len() <= 64 && !n.starts_with(|c: char| c.is_ascii_digit()) && n.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

fn tools_of(map: &HashMap<String, Shared>, only: Option<&str>) -> Vec<Value> {
    let mut out = vec![];
    for (id, s) in map {
        if only.is_some_and(|o| o != id) {
            continue;
        }
        for t in &s.lock().unwrap_or_else(|p| p.into_inner()).tools {
            let mut t = t.clone();
            t["server"] = json!(id);
            out.push(t);
        }
    }
    out
}

/// Starts the server (initialize + tools/list) and returns its tools.
#[tauri::command]
pub async fn mcp_start(app: AppHandle, state: State<'_, Mcp>, spec: StartSpec) -> Result<Vec<Value>, String> {
    if !valid_id(&spec.id) {
        return Err("invalid server id".into());
    }
    {
        let map = state.0.lock().map_err(|e| e.to_string())?;
        if map.contains_key(&spec.id) {
            return Ok(tools_of(&map, Some(&spec.id)));
        }
    }
    let cwd = install_dir(&app, "mcp", &spec.id)?;
    if !cwd.is_dir() {
        return Err("server is not installed".into());
    }
    let exe = resolve(&spec.command, &std::env::var("PATH").unwrap_or_default(), cfg!(windows))?;
    let mut secrets = vec![];
    for n in &spec.secret_names {
        if !valid_env_name(n) {
            return Err(format!("bad secret name {n:?}"));
        }
        let v = super::credentials::get_credential("hub.skills".into(), format!("env:{}:{n}", spec.id))?;
        secrets.push((n.clone(), v.ok_or_else(|| format!("secret {n} is not set"))?));
    }
    if let Some(bad) = spec.env.keys().find(|k| !valid_env_name(k)) {
        return Err(format!("bad env name {bad:?}"));
    }
    let env = build_env(|k| std::env::var(k).ok(), &spec.env, &secrets);
    let args = spec.args.clone();
    let server = tauri::async_runtime::spawn_blocking(move || Server::spawn(&exe, &args, &cwd, env))
        .await
        .map_err(|e| e.to_string())??;
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    map.insert(spec.id.clone(), Arc::new(Mutex::new(server)));
    Ok(tools_of(&map, Some(&spec.id)))
}

#[tauri::command]
pub fn mcp_stop(state: State<'_, Mcp>, id: String) -> Result<(), String> {
    state.0.lock().map_err(|e| e.to_string())?.remove(&id); // Drop kills the process
    Ok(())
}

/// App exit and game mode: stop every server.
pub fn stop_all(app: &AppHandle) {
    if let Ok(mut m) = app.state::<Mcp>().0.lock() {
        m.clear();
    }
}

#[tauri::command]
pub fn mcp_running(state: State<'_, Mcp>) -> Result<Vec<String>, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.keys().cloned().collect())
}

/// Tools of every running server (each tagged with `server`).
#[tauri::command]
pub fn mcp_tools(state: State<'_, Mcp>) -> Result<Vec<Value>, String> {
    let map = state.0.lock().map_err(|e| e.to_string())?;
    Ok(tools_of(&map, None))
}

#[tauri::command]
pub async fn mcp_call(state: State<'_, Mcp>, id: String, tool: String, args: Value) -> Result<Value, String> {
    let s = state.0.lock().map_err(|e| e.to_string())?.get(&id).cloned().ok_or("server is not running")?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut s = s.lock().unwrap_or_else(|p| p.into_inner());
        if !s.tools.iter().any(|t| t["name"] == tool.as_str()) {
            return Err(format!("unknown tool {tool}"));
        }
        s.request("tools/call", json!({"name": tool, "arguments": args}), Duration::from_secs(60))
    })
    .await
    .map_err(|e| e.to_string())?
}
