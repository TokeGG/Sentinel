// Catches exactly one OAuth redirect on 127.0.0.1:<port> and returns its
// `code` query param. No persistent server — the listener closes itself
// after the first request (or after `timeout_secs`). This is the standard
// "installed app" PKCE flow: the browser does the Google sign-in, Google
// redirects to this loopback port, we never see the user's Google password.
#[tauri::command]
pub fn oauth_listen_once(port: u16, timeout_secs: u64) -> Result<String, String> {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    let listener =
        TcpListener::bind(("127.0.0.1", port)).map_err(|e| format!("bind {port}: {e}"))?;
    listener
        .set_nonblocking(false)
        .map_err(|e| e.to_string())?;
    listener
        .set_ttl(64)
        .ok();
    // Simple timeout: bound the accept with a thread-based deadline.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    listener.set_nonblocking(true).ok();
    let (mut stream, _) = loop {
        match listener.accept() {
            Ok(conn) => break conn,
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if std::time::Instant::now() > deadline {
                    return Err("timed out waiting for the OAuth redirect".into());
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Err(e) => return Err(e.to_string()),
        }
    };
    stream.set_nonblocking(false).ok();

    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);
    let first_line = request.lines().next().unwrap_or("");

    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
        <html><body>Signed in — you can close this tab and return to Sentinel.</body></html>";
    let _ = stream.write_all(response.as_bytes());

    let code_re = regex_lite::Regex::new(r"code=([^&\s]+)").unwrap();
    code_re
        .captures(first_line)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .ok_or_else(|| "no ?code= in the redirect — sign-in may have been cancelled".into())
}

