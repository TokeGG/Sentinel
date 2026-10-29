use super::oauth_cb::{parse_callback, Cb};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};

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

fn listen(port: u16, timeout_secs: u64, path: Option<String>, state: Option<String>) -> Result<String, String> {
    let path = path.unwrap_or_else(|| "/".into());
    let listener = TcpListener::bind(("127.0.0.1", port)).map_err(|e| format!("bind {port}: {e}"))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    loop {
        let mut stream = match listener.accept() {
            Ok((s, _)) => s,
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline {
                    return Err("timed out waiting for the sign-in redirect".into());
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
