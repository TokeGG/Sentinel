use super::mail::{blocking, connect, MailAcct};
use base64::Engine;
use serde::Deserialize;

// Saves a draft copy to the IMAP Drafts folder (APPEND with \Draft). Only the
// Email compose "Save to server" button calls it; autosave stays local.

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftMsg {
    from: String,
    to: String,
    cc: String,
    subject: String,
    body: String,
}

fn clean(s: &str) -> String {
    s.chars().filter(|c| *c != '\r' && *c != '\n').collect()
}

fn word(s: &str) -> String {
    let s = clean(s);
    if s.is_ascii() { s } else { format!("=?UTF-8?B?{}?=", base64::engine::general_purpose::STANDARD.encode(s)) }
}

/// Pure: a minimal RFC 822 text/plain message. Header values lose CR/LF (no injection).
pub fn draft_raw(d: &DraftMsg) -> String {
    let mut h = format!("From: {}\r\n", clean(&d.from));
    if !d.to.trim().is_empty() { h += &format!("To: {}\r\n", clean(&d.to)); }
    if !d.cc.trim().is_empty() { h += &format!("Cc: {}\r\n", clean(&d.cc)); }
    let body = base64::engine::general_purpose::STANDARD.encode(d.body.replace("\r\n", "\n").replace('\n', "\r\n"));
    let wrapped: Vec<&str> = body.as_bytes().chunks(76).map(|c| std::str::from_utf8(c).unwrap_or("")).collect();
    format!("{h}Subject: {}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n{}\r\n", word(&d.subject), wrapped.join("\r\n"))
}

#[tauri::command]
pub async fn mail_append_draft(acct: MailAcct, folder: String, msg: DraftMsg) -> Result<(), String> {
    blocking(move || {
        let mut s = connect(&acct)?;
        s.append_with_flags(&folder, draft_raw(&msg), &[imap::types::Flag::Draft, imap::types::Flag::Seen]).map_err(|e| e.to_string())?;
        s.logout().ok();
        Ok(())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_header_injection_and_encodes_subject() {
        let d = DraftMsg { from: "me@x.com".into(), to: "a@x.com\r\nBcc: e@x.com".into(), cc: "".into(), subject: "Héllo".into(), body: "hi".into() };
        let r = draft_raw(&d);
        assert!(!r.contains("\r\nBcc:"));
        assert!(r.contains("Subject: =?UTF-8?B?"));
        assert!(!r.contains("Cc:"));
    }
}
