use super::oauth_cb::{parse_callback, Cb};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};

// Ports whose waiting listener should stop now (Cancel button); checked every 100 ms.
static CANCELLED: Mutex<Vec<u16>> = Mutex::new(Vec::new());

fn take_cancel(port: u16) -> bool {
    let mut v = CANCELLED.lock().unwrap_or_else(|e| e.into_inner());
    let hit = v.contains(&port);
    v.retain(|p| *p != port);
    hit
}

/// Stops a waiting `oauth_listen_once` on `port` and frees the port.
#[tauri::command]
pub fn oauth_cancel(port: u16) {
    CANCELLED.lock().unwrap_or_else(|e| e.into_inner()).push(port);
}

// Generic loopback redirect catcher for OAuth2 "installed app" flows (PKCE):
// the browser signs in, the provider redirects to http://127.0.0.1:<port><path>,
// we never see a password. Binds 127.0.0.1 only, answers one real callback and
// closes. Anything else (favicon, other paths, wrong/missing `state`) gets a
// 404 and is ignored until `timeout_secs`. Returns the `code`; `error=` -> Err.
fn reply(mut s: TcpStream, status: &str, body: &str) {
    let r = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = s.write_all(r.as_bytes());
}

const OK: &str = "<!doctype html><meta charset=utf-8><title>Sentinel</title><body>You can close this tab and return to Sentinel.</body>";
const NO: &str = "<!doctype html><meta charset=utf-8><title>Sentinel</title><body>Sign-in was not completed. You can close this tab.</body>";

/// Async + spawn_blocking: a sync command would run on the main thread and freeze the UI while waiting.
#[tauri::command]
pub async fn oauth_listen_once(port: u16, timeout_secs: u64, path: Option<String>, state: Option<String>) -> Result<String, String> {
    super::mail::blocking(move || listen(port, timeout_secs, path, state)).await
}

fn bind_error(port: u16, e: &std::io::Error) -> String {
    if e.kind() == std::io::ErrorKind::AddrInUse {
        format!("port_in_use: port {port} is already in use (another sign-in still waiting, or another program). Cancel other sign-ins or close that program, then press Connect again.")
    } else {
        format!("port_blocked: could not listen on 127.0.0.1:{port} ({e}). A firewall or security tool may block it.")
    }
}

fn listen(port: u16, timeout_secs: u64, path: Option<String>, state: Option<String>) -> Result<String, String> {
    let path = path.unwrap_or_else(|| "/".into());
    let listener = TcpListener::bind(("127.0.0.1", port)).map_err(|e| bind_error(port, &e))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    // `http://localhost` redirects (Microsoft) may resolve to ::1 first on Windows: listen there too (best effort).
    let v6 = TcpListener::bind(("::1", port)).ok().filter(|l| l.set_nonblocking(true).is_ok());
    take_cancel(port); // a stale cancel from an earlier sign-in must not stop this one
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    loop {
        let got = match listener.accept() {
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => v6.as_ref().map_or_else(|| Err(std::io::ErrorKind::WouldBlock.into()), |l| l.accept()),
            r => r,
        };
        let mut stream = match got {
            Ok((s, _)) => s,
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if take_cancel(port) {
                    return Err("cancelled: sign-in cancelled".into());
                }
                if Instant::now() > deadline {
                    return Err("timeout: no sign-in redirect arrived within the time limit".into());
                }
                std::thread::sleep(Duration::from_millis(100));
                continue;
            }
            Err(e) => return Err(e.to_string()),
        };
        stream.set_nonblocking(false).ok();
        stream.set_read_timeout(Some(Duration::from_secs(2))).ok();
        let mut buf = [0u8; 4096];
        let n = stream.read(&mut buf).unwrap_or(0);
        let req = String::from_utf8_lossy(&buf[..n]);
        match parse_callback(req.lines().next().unwrap_or(""), &path, state.as_deref()) {
            Cb::Ignore => reply(stream, "404 Not Found", NO),
            Cb::Code(c) => {
                reply(stream, "200 OK", OK);
                return Ok(c);
            }
            Cb::Denied(e) => {
                reply(stream, "200 OK", NO);
                return Err(format!("sign-in refused: {e}"));
            }
        }
    }
}
