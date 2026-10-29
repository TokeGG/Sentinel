use super::mail::{blocking, connect, MailAcct};
use lettre::message::{Mailbox, Message};
use lettre::transport::smtp::authentication::{Credentials, Mechanism};
use lettre::{SmtpTransport, Transport};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmtpCfg {
    host: String,
    port: u16,
    /// "ssl" (implicit TLS, 465) or "starttls" (587).
    tls: String,
    username: String,
    password: String,
    #[serde(default)]
    auth: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Outgoing {
    from: String,
    to: Vec<String>,
    cc: Vec<String>,
    bcc: Vec<String>,
    subject: String,
    body: String,
    in_reply_to: Option<String>,
}

fn mailbox(s: &str) -> Result<Mailbox, String> {
    s.parse::<Mailbox>().map_err(|e| format!("bad address {s:?}: {e}"))
}

fn build(o: &Outgoing) -> Result<Message, String> {
    let mut b = Message::builder().from(mailbox(&o.from)?).subject(o.subject.clone());
    for (list, kind) in [(&o.to, 0), (&o.cc, 1), (&o.bcc, 2)] {
        for a in list {
            let m = mailbox(a)?;
            b = match kind {
                0 => b.to(m),
                1 => b.cc(m),
                _ => b.bcc(m),
            };
        }
    }
    if let Some(id) = o.in_reply_to.as_ref().filter(|s| !s.is_empty()) {
        b = b.in_reply_to(id.clone()).references(id.clone());
    }
    b.body(o.body.clone()).map_err(|e| e.to_string())
}

/// Sends over SMTP, then (when `sent` is given) appends the sent copy to that
/// IMAP folder. The append is best-effort: Ok(false) means sent but not filed.
/// Only the Email panel's explicit Send button reaches this command.
#[tauri::command]
pub async fn mail_send(smtp: SmtpCfg, msg: Outgoing, sent: Option<(MailAcct, String)>) -> Result<bool, String> {
    blocking(move || {
        let email = build(&msg)?;
        let creds = Credentials::new(smtp.username, smtp.password);
        let creds_mech = if smtp.auth == "xoauth2" { vec![Mechanism::Xoauth2] } else { vec![Mechanism::Plain, Mechanism::Login] };
        let relay = if smtp.tls == "starttls" { SmtpTransport::starttls_relay(&smtp.host) } else { SmtpTransport::relay(&smtp.host) };
        let mailer = relay.map_err(|e| e.to_string())?.port(smtp.port).credentials(creds).authentication(creds_mech).build();
        mailer.send(&email).map_err(|e| e.to_string())?;
        let Some((acct, folder)) = sent else { return Ok(false) };
        let filed = (|| -> Result<(), String> {
            let mut s = connect(&acct)?;
            s.append_with_flags(&folder, email.formatted(), &[imap::types::Flag::Seen]).map_err(|e| e.to_string())?;
            s.logout().ok();
            Ok(())
        })();
        Ok(filed.is_ok())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn out() -> Outgoing {
        Outgoing { from: "me@x.com".into(), to: vec!["A <a@x.com>".into()], cc: vec!["c@x.com".into()], bcc: vec!["b@x.com".into()],
            subject: "Hi\r\nBcc: evil@x.com".into(), body: "yo".into(), in_reply_to: Some("<1@x>".into()) }
    }

    #[test]
    fn builds_with_cc_and_reply_headers_and_no_header_injection() {
        let raw = String::from_utf8(build(&out()).unwrap().formatted()).unwrap();
        assert!(raw.contains("Cc: c@x.com"));
        assert!(raw.contains("In-Reply-To: <1@x>"));
        assert!(!raw.contains("\r\nBcc: evil@x.com"));
    }

    #[test]
    fn rejects_bad_address() {
        let mut o = out();
        o.to = vec!["not an address".into()];
        assert!(build(&o).is_err());
    }
}
