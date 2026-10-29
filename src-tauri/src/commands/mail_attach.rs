use super::mail::{blocking, connect, MailAcct};
use base64::Engine;
use mail_parser::{MessageParser, MimeHeaders};
use serde::Serialize;

// One attachment of one message, by its index in the parsed attachment list
// (same order as MailBody.attachments). Fetched only on a user click.

const PREVIEW_CAP: usize = 15_000_000;

#[derive(Serialize)]
pub struct MailAttachData {
    name: String,
    mime: String,
    /// base64 of the bytes (preview only; capped at PREVIEW_CAP).
    data: String,
}

/// Pure: (name, mime, bytes) of attachment `index` in a raw message.
pub fn attachment_of(raw: &[u8], index: usize) -> Option<(String, String, Vec<u8>)> {
    let m = MessageParser::default().parse(raw)?;
    let p = m.attachments().nth(index)?;
    let mime = p
        .content_type()
        .map(|c| format!("{}/{}", c.ctype(), c.subtype().unwrap_or("octet-stream")))
        .unwrap_or_else(|| "application/octet-stream".into());
    Some((p.attachment_name().unwrap_or("attachment").to_string(), mime, p.contents().to_vec()))
}

fn fetch_raw(acct: &MailAcct, folder: &str, uid: u32) -> Result<Vec<u8>, String> {
    let mut s = connect(acct)?;
    s.select(folder).map_err(|e| e.to_string())?;
    let f = s.uid_fetch(uid.to_string(), "BODY.PEEK[]").map_err(|e| e.to_string())?;
    let raw = f.iter().find_map(|x| x.body()).ok_or("message not found on server")?.to_vec();
    drop(f);
    s.logout().ok();
    Ok(raw)
}

#[tauri::command]
pub async fn mail_fetch_attachment(acct: MailAcct, folder: String, uid: u32, index: usize) -> Result<MailAttachData, String> {
    blocking(move || {
        let (name, mime, bytes) = attachment_of(&fetch_raw(&acct, &folder, uid)?, index).ok_or("attachment not found")?;
        if bytes.len() > PREVIEW_CAP {
            return Err("attachment too large to preview; use Save".into());
        }
        Ok(MailAttachData { name, mime, data: base64::engine::general_purpose::STANDARD.encode(bytes) })
    })
    .await
}

/// Writes the attachment to `path`, which the user picked in the save dialog.
#[tauri::command]
pub async fn mail_save_attachment(acct: MailAcct, folder: String, uid: u32, index: usize, path: String) -> Result<usize, String> {
    blocking(move || {
        let (_, _, bytes) = attachment_of(&fetch_raw(&acct, &folder, uid)?, index).ok_or("attachment not found")?;
        std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
        Ok(bytes.len())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    const MIME: &[u8] = b"From: a@x.com\r\nSubject: t\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"B\"\r\n\r\n--B\r\nContent-Type: text/plain\r\n\r\nbody\r\n--B\r\nContent-Type: application/pdf; name=\"f.pdf\"\r\nContent-Disposition: attachment; filename=\"f.pdf\"\r\nContent-Transfer-Encoding: base64\r\n\r\nSGVsbG8=\r\n--B--\r\n";

    #[test]
    fn extracts_attachment_bytes() {
        let (n, m, b) = attachment_of(MIME, 0).unwrap();
        assert_eq!((n.as_str(), m.as_str(), b.as_slice()), ("f.pdf", "application/pdf", b"Hello".as_slice()));
        assert!(attachment_of(MIME, 1).is_none());
    }
}
