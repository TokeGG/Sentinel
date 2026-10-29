// One MCP server child process: argument vector only (never a shell string),
// cleared environment rebuilt from a small passthrough list + non-secret config
// + keychain secrets, cwd = the server's install dir.
use super::mcp_rpc::{self, Msg};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{channel, Receiver};
use std::time::{Duration, Instant};

/// The user's own runtimes only; no arbitrary executables.
pub const ALLOWED: [&str; 10] = ["npx", "uvx", "node", "python", "python3", "py", "uv", "deno", "bun", "bunx"];
const PASS: [&str; 14] = [
    "PATH", "PATHEXT", "SYSTEMROOT", "COMSPEC", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA",
    "LANG", "PROGRAMFILES", "PROGRAMDATA", "USER",
];

/// Finds `cmd` on `path` (adding .exe/.cmd/.bat on Windows). Err = clear "not found" text.
pub fn resolve(cmd: &str, path: &str, windows: bool) -> Result<PathBuf, String> {
    if !ALLOWED.contains(&cmd) {
        return Err(format!("command {cmd:?} is not allowed (use one of: {})", ALLOWED.join(", ")));
    }
    let exts: &[&str] = if windows { &[".exe", ".cmd", ".bat"] } else { &[""] };
    let sep = if windows { ';' } else { ':' };
    for dir in path.split(sep).filter(|d| !d.is_empty()) {
        for e in exts {
            let p = Path::new(dir).join(format!("{cmd}{e}"));
            if p.is_file() {
                return Ok(p);
            }
        }
    }
    Err(format!("{cmd} not found on PATH - install Node.js (npx) or Python (uvx) first"))
}

/// Environment for the child: passthrough vars, then config, then secrets (later wins).
pub fn build_env(
    parent: impl Fn(&str) -> Option<String>,
    config: &HashMap<String, String>,
    secrets: &[(String, String)],
) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = PASS.iter().filter_map(|k| parent(k).map(|v| (k.to_string(), v))).collect();
    out.extend(config.iter().map(|(k, v)| (k.clone(), v.clone())));
    out.extend(secrets.iter().cloned());
    out
}

pub struct Server {
    child: Child,
    stdin: ChildStdin,
    rx: Receiver<String>,
    next: u64,
    pub tools: Vec<Value>,
}

impl Server {
    pub fn spawn(exe: &Path, args: &[String], cwd: &Path, env: Vec<(String, String)>) -> Result<Server, String> {
        let mut cmd = Command::new(exe);
        cmd.args(args).current_dir(cwd).env_clear().envs(env);
        cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
        #[cfg(windows)]
        std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000); // no console window
        let mut child = cmd.spawn().map_err(|e| format!("could not start server: {e}"))?;
        let out = child.stdout.take().ok_or("no stdout")?;
        let stdin = child.stdin.take().ok_or("no stdin")?;
        let (tx, rx) = channel();
        std::thread::spawn(move || {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                if tx.send(line).is_err() {
                    break;
                }
            }
        });
        let mut s = Server { child, stdin, rx, next: 1, tools: vec![] };
        s.request("initialize", mcp_rpc::initialize_params(), Duration::from_secs(60))?;
        s.send(&mcp_rpc::notification("notifications/initialized"))?;
        s.tools = s.list_tools()?;
        Ok(s)
    }

    fn send(&mut self, line: &str) -> Result<(), String> {
        writeln!(self.stdin, "{line}").and_then(|_| self.stdin.flush()).map_err(|e| format!("server closed: {e}"))
    }

    /// Sends a request and waits (up to `timeout`) for the reply with the same id.
    pub fn request(&mut self, method: &str, params: Value, timeout: Duration) -> Result<Value, String> {
        let id = self.next;
        self.next += 1;
        self.send(&mcp_rpc::request(id, method, params))?;
        let end = Instant::now() + timeout;
        loop {
            let left = end.saturating_duration_since(Instant::now());
            let line = self.rx.recv_timeout(left).map_err(|_| format!("{method}: timed out or server exited"))?;
            if let Some(Msg::Response(rid, r)) = mcp_rpc::parse_line(&line) {
                if rid == id {
                    return r;
                }
            }
        }
    }

    fn list_tools(&mut self) -> Result<Vec<Value>, String> {
        let mut all = vec![];
        let mut cursor = Value::Null;
        for _ in 0..5 {
            let p = if cursor.is_null() { json!({}) } else { json!({"cursor": cursor}) };
            let r = self.request("tools/list", p, Duration::from_secs(20))?;
            all.extend(r["tools"].as_array().cloned().unwrap_or_default());
            cursor = r["nextCursor"].clone();
            if cursor.is_null() {
                break;
            }
        }
        Ok(all)
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_allows_only_listed_runtimes() {
        assert!(resolve("bash", "/bin", false).unwrap_err().contains("not allowed"));
        assert!(resolve("../npx", "/bin", false).is_err());
        let dir = std::env::temp_dir().join(format!("sentinel-mcp-path-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("npx.cmd"), "").unwrap();
        let p = dir.to_str().unwrap();
        assert!(resolve("npx", p, true).unwrap().ends_with("npx.cmd"));
        assert!(resolve("npx", p, false).unwrap_err().contains("npx not found"));
        assert!(resolve("uvx", p, true).unwrap_err().contains("uvx not found"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn env_is_cleared_then_layered() {
        let parent = |k: &str| match k { "PATH" => Some("/bin".to_string()), "AWS_SECRET" => Some("leak".to_string()), _ => None };
        let cfg = HashMap::from([("MODE".to_string(), "x".to_string()), ("PATH".to_string(), "/opt".to_string())]);
        let env = build_env(parent, &cfg, &[("API_KEY".into(), "s3".into())]);
        assert!(env.iter().all(|(k, _)| k != "AWS_SECRET"));
        assert_eq!(env.last().unwrap(), &("API_KEY".to_string(), "s3".to_string()));
        assert_eq!(env.iter().rfind(|(k, _)| k == "PATH").unwrap().1, "/opt");
    }

    // Talks to a tiny fake MCP server written in Python (skipped when python3 is absent).
    #[test]
    fn handshake_list_and_call_against_a_fake_server() {
        let Ok(py) = resolve("python3", &std::env::var("PATH").unwrap_or_default(), false) else { return };
        let script = r#"
import sys, json
for line in sys.stdin:
    m = json.loads(line)
    if "id" not in m: continue
    r = {"tools": [{"name": "echo"}]} if m["method"] == "tools/list" else {"echo": m.get("params")}
    print("not json noise", flush=True)
    print(json.dumps({"jsonrpc": "2.0", "id": m["id"], "result": r}), flush=True)
"#;
        let args = vec!["-c".to_string(), script.to_string()];
        let mut s = Server::spawn(&py, &args, &std::env::temp_dir(), build_env(|k| std::env::var(k).ok(), &HashMap::new(), &[])).unwrap();
        assert_eq!(s.tools[0]["name"], "echo");
        let r = s.request("tools/call", json!({"name": "echo"}), Duration::from_secs(5)).unwrap();
        assert_eq!(r["echo"]["name"], "echo");
        let mut dead = Server::spawn(&py, &["-c".into(), "pass".into()], &std::env::temp_dir(), vec![]);
        assert!(dead.is_err());
        let _ = dead.as_mut().map(|d| d.tools.clear());
    }
}
