use serde::{Deserialize, Serialize};
use std::net::TcpStream;

// Shared IMAP plumbing for the mail commands (mail_fetch / mail_body /
// mail_ops / mail_send). The password is passed in per call by the TS side,
// which reads it from the OS keychain; nothing here stores or logs it.
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MailAcct {
    pub host: String,
    pub port: u16,
    /// "ssl" (implicit TLS, e.g. 993) or "starttls" (e.g. 143). Never plaintext.
    pub tls: String,
    pub username: String,
    pub password: String,
}

pub type Sess = imap::Session<native_tls::TlsStream<TcpStream>>;

pub fn connect(a: &MailAcct) -> Result<Sess, String> {
    let tls = native_tls::TlsConnector::builder().build().map_err(|e| e.to_string())?;
    let addr = (a.host.as_str(), a.port);
    let client = if a.tls == "starttls" {
        imap::connect_starttls(addr, &a.host, &tls)
    } else {
        imap::connect(addr, &a.host, &tls)
    }
    .map_err(|e| e.to_string())?;
    client.login(&a.username, &a.password).map_err(|e| e.0.to_string())
}

/// Runs blocking IMAP/SMTP work off the async runtime.
pub async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())?
}

#[derive(Serialize)]
pub struct MailFolder {
    name: String,
    /// Special-use attributes such as "\\Sent"; the TS side decides the role.
    attrs: Vec<String>,
}

#[tauri::command]
pub async fn mail_list_folders(acct: MailAcct) -> Result<Vec<MailFolder>, String> {
    blocking(move || {
        let mut s = connect(&acct)?;
        let names = s.list(Some(""), Some("*")).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for n in names.iter() {
            let mut attrs = Vec::new();
            let mut selectable = true;
            for a in n.attributes() {
                match a {
                    imap::types::NameAttribute::NoSelect => selectable = false,
                    imap::types::NameAttribute::Custom(c) => attrs.push(c.to_string()),
                    _ => {}
                }
            }
            if selectable {
                out.push(MailFolder { name: n.name().to_string(), attrs });
            }
        }
        s.logout().ok();
        Ok(out)
    })
    .await
}
