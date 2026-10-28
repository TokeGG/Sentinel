use serde::Serialize;
use sysinfo::{Disks, System};
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize)]
struct PcMetrics {
    cpu_percent: f32,
    ram_used_mb: u64,
    ram_total_mb: u64,
    disks: Vec<DiskMetric>,
}

#[derive(Serialize)]
struct DiskMetric {
    mount: String,
    used_gb: f64,
    total_gb: f64,
}

// Read-only snapshot — PC Care's `get_metrics` skill. No cleanup/write paths
// here; those come later behind an explicit preview-before-apply step.
#[tauri::command]
fn get_pc_metrics() -> PcMetrics {
    let mut sys = System::new_all();
    sys.refresh_cpu_usage();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_percent = sys.global_cpu_usage();
    let ram_used_mb = sys.used_memory() / 1024 / 1024;
    let ram_total_mb = sys.total_memory() / 1024 / 1024;

    let disks = Disks::new_with_refreshed_list()
        .iter()
        .map(|d| DiskMetric {
            mount: d.mount_point().to_string_lossy().into_owned(),
            used_gb: (d.total_space() - d.available_space()) as f64 / 1e9,
            total_gb: d.total_space() as f64 / 1e9,
        })
        .collect();

    PcMetrics { cpu_percent, ram_used_mb, ram_total_mb, disks }
}

#[derive(Serialize)]
struct TempFile {
    path: String,
    size_bytes: u64,
}

// PC Care cleanup, scoped to exactly one allowlisted category: the OS temp
// directory (`std::env::temp_dir()` — e.g. %TEMP% on Windows). Never touches
// Documents, Downloads, browser profiles, or anything outside this one path,
// per the "never delete user documents/unknown files" rule. Read-only
// listing — nothing is deleted here.
#[tauri::command]
fn preview_temp_cleanup() -> Result<Vec<TempFile>, String> {
    let dir = std::env::temp_dir();
    let mut out = Vec::new();
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        if let Ok(meta) = entry.metadata() {
            if meta.is_file() {
                out.push(TempFile {
                    path: entry.path().to_string_lossy().into_owned(),
                    size_bytes: meta.len(),
                });
            }
        }
    }
    Ok(out)
}

// Deletes exactly the paths it's given — the TS side always calls this with
// paths that came from `preview_temp_cleanup`'s own output, never a
// user-typed path, so this can't be pointed outside the temp dir by a bad
// argument from anywhere else in the app.
#[tauri::command]
fn apply_temp_cleanup(paths: Vec<String>) -> (u32, u32) {
    let mut deleted = 0;
    let mut failed = 0;
    let temp_dir = std::env::temp_dir();
    for p in paths {
        let path = std::path::Path::new(&p);
        // Defense in depth: refuse anything not actually inside temp_dir,
        // even though the TS caller should never send such a path.
        if !path.starts_with(&temp_dir) {
            failed += 1;
            continue;
        }
        match std::fs::remove_file(path) {
            Ok(()) => deleted += 1,
            Err(_) => failed += 1,
        }
    }
    (deleted, failed)
}

#[derive(Serialize)]
struct NetDevice {
    ip: String,
    mac: String,
}

// Passive: reads the OS's own ARP cache (`arp -a`) — devices this machine has
// already talked to, no raw sockets, no admin rights, no new driver. An
// active sweep of the whole subnet is a possible later upgrade but needs
// raw-socket access (Npcap on Windows, which needs admin) — out of scope for
// this first pass.
#[tauri::command]
fn get_network_devices() -> Result<Vec<NetDevice>, String> {
    let output = std::process::Command::new("arp")
        .arg("-a")
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout);

    let ip_re = regex_lite::Regex::new(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})").unwrap();
    let mac_re = regex_lite::Regex::new(r"([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}").unwrap();

    let mut devices = Vec::new();
    for line in text.lines() {
        let ip = ip_re.find(line).map(|m| m.as_str().to_string());
        let mac = mac_re.find(line).map(|m| m.as_str().to_string());
        if let (Some(ip), Some(mac)) = (ip, mac) {
            devices.push(NetDevice { ip, mac });
        }
    }
    Ok(devices)
}

// clone_repo: shells out to the system `git`, nothing more — "install" in
// GitHub Discovery means clone-to-folder, never executing the repo's code.
#[tauri::command]
fn clone_repo(url: String, dest_dir: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(["clone", &url])
        .current_dir(&dest_dir)
        .output()
        .map_err(|e| format!("couldn't run git: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).into_owned());
    }
    Ok(dest_dir)
}

// Catches exactly one OAuth redirect on 127.0.0.1:<port> and returns its
// `code` query param. No persistent server — the listener closes itself
// after the first request (or after `timeout_secs`). This is the standard
// "installed app" PKCE flow: the browser does the Google sign-in, Google
// redirects to this loopback port, we never see the user's Google password.
#[tauri::command]
fn oauth_listen_once(port: u16, timeout_secs: u64) -> Result<String, String> {
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

#[derive(Serialize)]
struct MailHeader {
    uid: u32,
    from: String,
    subject: String,
    date: String,
}

// Read-only IMAP fetch: connects, pulls the most recent `limit` message
// headers from INBOX, disconnects. No message is ever deleted or marked —
// this command only reads. Blocking (the `imap`/`native-tls` crates are
// sync), run off the main thread by Tauri's async command machinery.
#[tauri::command]
async fn imap_fetch_inbox(
    host: String,
    port: u16,
    username: String,
    password: String,
    limit: u32,
) -> Result<Vec<MailHeader>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let tls = native_tls::TlsConnector::builder()
            .build()
            .map_err(|e| e.to_string())?;
        let client = imap::connect((host.as_str(), port), &host, &tls).map_err(|e| e.to_string())?;
        let mut session = client
            .login(&username, &password)
            .map_err(|e| e.0.to_string())?;
        let mailbox = session.select("INBOX").map_err(|e| e.to_string())?;

        let total = mailbox.exists;
        if total == 0 {
            session.logout().ok();
            return Ok(vec![]);
        }
        let start = total.saturating_sub(limit.saturating_sub(1)).max(1);
        let seq = format!("{start}:{total}");

        let messages = session
            .fetch(&seq, "(UID ENVELOPE)")
            .map_err(|e| e.to_string())?;

        let mut headers: Vec<MailHeader> = messages
            .iter()
            .filter_map(|m| {
                let env = m.envelope()?;
                let from = env
                    .from
                    .as_ref()
                    .and_then(|addrs| addrs.first())
                    .map(|a| {
                        let mailbox = a.mailbox.as_ref().map(|m| String::from_utf8_lossy(m).into_owned());
                        let host = a.host.as_ref().map(|h| String::from_utf8_lossy(h).into_owned());
                        match (mailbox, host) {
                            (Some(m), Some(h)) => format!("{m}@{h}"),
                            (Some(m), None) => m,
                            _ => "(unknown)".to_string(),
                        }
                    })
                    .unwrap_or_else(|| "(unknown)".to_string());
                let subject = env
                    .subject
                    .as_ref()
                    .map(|s| String::from_utf8_lossy(s).into_owned())
                    .unwrap_or_else(|| "(no subject)".to_string());
                let date = env
                    .date
                    .as_ref()
                    .map(|d| String::from_utf8_lossy(d).into_owned())
                    .unwrap_or_default();
                Some(MailHeader { uid: m.uid.unwrap_or(0), from, subject, date })
            })
            .collect();
        headers.reverse(); // newest first

        session.logout().ok();
        Ok(headers)
    })
    .await
    .map_err(|e| e.to_string())?
}

// SMTP send — a distinct, explicit command from the fetch path. Nothing
// else in the app calls this implicitly; only the Email module's `send_mail`
// skill does, and only on direct user action from the UI.
#[tauri::command]
async fn smtp_send_mail(
    host: String,
    port: u16,
    username: String,
    password: String,
    to: String,
    subject: String,
    body: String,
) -> Result<(), String> {
    use lettre::message::Message;
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::{SmtpTransport, Transport};

    tauri::async_runtime::spawn_blocking(move || {
        let email = Message::builder()
            .from(username.parse().map_err(|e: lettre::address::AddressError| e.to_string())?)
            .to(to.parse().map_err(|e: lettre::address::AddressError| e.to_string())?)
            .subject(subject)
            .body(body)
            .map_err(|e| e.to_string())?;

        let creds = Credentials::new(username, password);
        let mailer = SmtpTransport::relay(&host)
            .map_err(|e| e.to_string())?
            .port(port)
            .credentials(creds)
            .build();

        mailer.send(&email).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
struct FoundFile {
    path: String,
}

// Bounded recursive filename search — std library only, no indexing crate.
// Deliberately scoped: only searches the folders the caller passes (which
// the TS module keeps in its own `search_roots` table, user-added one at a
// time), stops descending past `max_depth`, and caps total results so a
// huge folder can't make this hang.
fn walk_search(dir: &std::path::Path, query: &str, depth: u32, max_depth: u32, out: &mut Vec<FoundFile>) {
    if depth > max_depth || out.len() >= 500 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        if out.len() >= 500 {
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if name.contains(&query.to_lowercase()) {
            out.push(FoundFile { path: path.to_string_lossy().into_owned() });
        }
        if path.is_dir() {
            walk_search(&path, query, depth + 1, max_depth, out);
        }
    }
}

#[tauri::command]
fn search_files(root: String, query: String) -> Vec<FoundFile> {
    let mut out = Vec::new();
    walk_search(std::path::Path::new(&root), &query, 0, 12, &mut out);
    out
}

#[cfg(test)]
mod search_tests {
    use super::*;
    use std::fs;

    // Builds a throwaway tree under the OS temp dir, runs the test, then
    // removes it — no fixture files checked into the repo.
    struct TempTree {
        root: std::path::PathBuf,
    }
    impl TempTree {
        fn new(name: &str) -> Self {
            let root = std::env::temp_dir().join(format!("sentinel-test-{name}"));
            let _ = fs::remove_dir_all(&root);
            fs::create_dir_all(&root).unwrap();
            TempTree { root }
        }
    }
    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn finds_a_matching_file_by_name_case_insensitively() {
        let tree = TempTree::new("match");
        fs::write(tree.root.join("Report.pdf"), b"x").unwrap();
        fs::write(tree.root.join("notes.txt"), b"x").unwrap();

        let mut out = Vec::new();
        walk_search(&tree.root, "report", 0, 12, &mut out);
        assert_eq!(out.len(), 1);
        assert!(out[0].path.ends_with("Report.pdf"));
    }

    #[test]
    fn descends_into_subdirectories() {
        let tree = TempTree::new("nested");
        let sub = tree.root.join("sub");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("deep-match.txt"), b"x").unwrap();

        let mut out = Vec::new();
        walk_search(&tree.root, "deep-match", 0, 12, &mut out);
        assert_eq!(out.len(), 1);
    }

    #[test]
    fn respects_max_depth() {
        let tree = TempTree::new("depth");
        let mut dir = tree.root.clone();
        for i in 0..5 {
            dir = dir.join(format!("d{i}"));
        }
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("too-deep.txt"), b"x").unwrap();

        let mut out = Vec::new();
        // max_depth 2: five levels of subfolders is well past it, should find nothing.
        walk_search(&tree.root, "too-deep", 0, 2, &mut out);
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn caps_total_results_at_500() {
        let tree = TempTree::new("cap");
        for i in 0..520 {
            fs::write(tree.root.join(format!("match-{i}.txt")), b"x").unwrap();
        }

        let mut out = Vec::new();
        walk_search(&tree.root, "match", 0, 12, &mut out);
        assert_eq!(out.len(), 500);
    }

    #[test]
    fn finds_nothing_for_a_non_matching_query() {
        let tree = TempTree::new("nomatch");
        fs::write(tree.root.join("file.txt"), b"x").unwrap();

        let mut out = Vec::new();
        walk_search(&tree.root, "zzz-no-such-thing", 0, 12, &mut out);
        assert_eq!(out.len(), 0);
    }
}

// Plain text file write — used by Pentest Lab's report generator. No
// overwrite confirmation here; the TS side builds a unique, timestamped
// filename before calling this.
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

// Pentest Lab's only recon primitive for this first pass: a plain TCP
// connect scan over an explicit, caller-supplied port list. No stealth, no
// exploitation, no port sweep of a whole subnet — just "is this port open",
// which is the same thing any `nc -zv` or basic port checker does. Scope
// enforcement (is this target even allowed) happens entirely on the TS side
// in the Pentest Lab module, BEFORE this is ever called — this command has
// no concept of engagements and will happily connect to whatever host it's
// given, so the gate matters more than this function does.
#[derive(Serialize)]
struct PortResult {
    port: u16,
    open: bool,
}

#[tauri::command]
async fn tcp_port_scan(host: String, ports: Vec<u16>, timeout_ms: u64) -> Vec<PortResult> {
    use std::net::{TcpStream, ToSocketAddrs};
    use std::time::Duration;

    tauri::async_runtime::spawn_blocking(move || {
        ports
            .into_iter()
            .map(|port| {
                let open = format!("{host}:{port}")
                    .to_socket_addrs()
                    .ok()
                    .and_then(|mut addrs| addrs.next())
                    .map(|addr| {
                        TcpStream::connect_timeout(&addr, Duration::from_millis(timeout_ms)).is_ok()
                    })
                    .unwrap_or(false);
                PortResult { port, open }
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

// Backup & Snapshot: copies the live sentinel.db (plus its WAL/SHM sidecar
// files, if SQLite is mid-write-ahead-log) to a folder you pick. Restore is
// the reverse, explicit and user-triggered only — never automatic.
fn db_file_names() -> [&'static str; 3] {
    ["sentinel.db", "sentinel.db-wal", "sentinel.db-shm"]
}

#[tauri::command]
fn backup_database(app: tauri::AppHandle, dest_dir: String) -> Result<String, String> {
    use tauri::Manager;
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let backup_dir = std::path::Path::new(&dest_dir).join(format!("sentinel-backup-{stamp}"));
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let mut copied = 0;
    for name in db_file_names() {
        let src = data_dir.join(name);
        if src.exists() {
            std::fs::copy(&src, backup_dir.join(name)).map_err(|e| e.to_string())?;
            copied += 1;
        }
    }
    if copied == 0 {
        return Err("no database file found to back up".into());
    }
    Ok(backup_dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn restore_database(app: tauri::AppHandle, backup_dir: String) -> Result<(), String> {
    use tauri::Manager;
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup = std::path::Path::new(&backup_dir);

    let mut restored = 0;
    for name in db_file_names() {
        let src = backup.join(name);
        if src.exists() {
            std::fs::copy(&src, data_dir.join(name)).map_err(|e| e.to_string())?;
            restored += 1;
        }
    }
    if restored == 0 {
        return Err("no database file found in that backup folder".into());
    }
    Ok(())
}

// OS-keychain credential helper (Foundation item, deferred until a module
// actually needed a real secret — GitHub Discovery and YouTube both do now).
// Every secret a module needs — a PAT, an OAuth client secret, an IMAP
// password — goes through here and only here. Nothing is ever written to
// SQLite or any plaintext file; "service" is the module id so one module
// can never read another's secret.
const KEYRING_APP: &str = "com.sentinel.app";

#[tauri::command]
fn set_credential(service: String, key: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_APP, &format!("{service}:{key}"))
        .map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_credential(service: String, key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_APP, &format!("{service}:{key}"))
        .map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_credential(service: String, key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_APP, &format!("{service}:{key}"))
        .map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// Foundation schema: module-agnostic activity log + the Notes module's own table.
// Each future module adds its own migration here, scoped to its own table(s) —
// this is the "generic panel + per-module manifest" pattern described in the plan.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "activity_log + notes",
            sql: "
                CREATE TABLE activity_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    module TEXT NOT NULL,
                    skill TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    result TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    body TEXT NOT NULL,
                    tags TEXT,
                    filed_to TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "news sources + items",
            sql: "
                CREATE TABLE news_sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL UNIQUE,
                    label TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE news_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER NOT NULL REFERENCES news_sources(id),
                    guid TEXT NOT NULL,
                    title TEXT NOT NULL,
                    link TEXT NOT NULL,
                    published_at TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (source_id, guid)
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "weather locations",
            sql: "
                CREATE TABLE weather_locations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    label TEXT NOT NULL,
                    lat REAL NOT NULL,
                    lon REAL NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "network devices",
            sql: "
                CREATE TABLE network_devices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip TEXT NOT NULL,
                    mac TEXT NOT NULL,
                    tag TEXT,
                    last_seen TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (mac)
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "cloned repos log",
            sql: "
                CREATE TABLE cloned_repos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repo TEXT NOT NULL,
                    dest_dir TEXT NOT NULL,
                    cloned_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "youtube subscriptions",
            sql: "
                CREATE TABLE youtube_subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel_id TEXT NOT NULL UNIQUE,
                    channel_title TEXT NOT NULL,
                    thumbnail_url TEXT,
                    uploads_playlist_id TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "finance watchlist",
            sql: "
                CREATE TABLE watchlist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK (kind IN ('stock', 'crypto')),
                    last_price REAL,
                    last_checked TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (symbol, kind)
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "deals sources + offers",
            sql: "
                CREATE TABLE deal_sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL UNIQUE,
                    label TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE deal_offers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER NOT NULL REFERENCES deal_sources(id),
                    guid TEXT NOT NULL,
                    title TEXT NOT NULL,
                    link TEXT NOT NULL,
                    published_at TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (source_id, guid)
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "congress trades",
            sql: "
                CREATE TABLE congress_trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chamber TEXT NOT NULL CHECK (chamber IN ('senate', 'house')),
                    politician TEXT NOT NULL,
                    ticker TEXT,
                    transaction_type TEXT,
                    trade_date TEXT,
                    amount_range TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (chamber, politician, ticker, trade_date, transaction_type, amount_range)
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "email inbox cache",
            sql: "
                CREATE TABLE email_inbox (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid INTEGER NOT NULL UNIQUE,
                    sender TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    mail_date TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "social posts (multi-platform)",
            sql: "
                CREATE TABLE social_posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    platform TEXT NOT NULL,
                    post_id TEXT NOT NULL,
                    author TEXT NOT NULL,
                    text TEXT NOT NULL,
                    link TEXT,
                    posted_at TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE (platform, post_id)
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "schedule settings",
            sql: "
                CREATE TABLE schedule_settings (
                    module_id TEXT PRIMARY KEY,
                    enabled INTEGER NOT NULL DEFAULT 0
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "pentest engagements + scan log",
            sql: "
                CREATE TABLE engagements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_name TEXT NOT NULL,
                    scope TEXT NOT NULL,
                    authorization_ref TEXT NOT NULL,
                    starts_at TEXT NOT NULL,
                    ends_at TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE scan_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    engagement_id INTEGER NOT NULL REFERENCES engagements(id),
                    target TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    open INTEGER NOT NULL,
                    scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "youtube videos",
            sql: "
                CREATE TABLE youtube_videos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel_id TEXT NOT NULL,
                    video_id TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    published_at TEXT,
                    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "clipboard history + quick launch",
            sql: "
                CREATE TABLE clipboard_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    copied_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE quick_launch_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    label TEXT NOT NULL,
                    path TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "file search roots",
            sql: "
                CREATE TABLE search_roots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
            ",
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:sentinel.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_pc_metrics,
            get_network_devices,
            clone_repo,
            oauth_listen_once,
            imap_fetch_inbox,
            smtp_send_mail,
            backup_database,
            restore_database,
            tcp_port_scan,
            write_text_file,
            preview_temp_cleanup,
            apply_temp_cleanup,
            search_files,
            set_credential,
            get_credential,
            delete_credential
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
