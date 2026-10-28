use serde::Serialize;

#[derive(Serialize)]
pub struct MailHeader {
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
pub async fn imap_fetch_inbox(
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
pub async fn smtp_send_mail(
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

