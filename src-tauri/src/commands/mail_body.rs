use super::mail::{blocking, connect, MailAcct};
use mail_parser::{Address, MessageParser, MimeHeaders};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct MailAddr {
    name: String,
    address: String,
}

#[derive(Serialize)]
pub struct MailAttachment {
    name: String,
    mime: String,
    size: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailBody {
    text: Option<String>,
    html: Option<String>,
    from: Vec<MailAddr>,
    to: Vec<MailAddr>,
    cc: Vec<MailAddr>,
    reply_to: Vec<MailAddr>,
    message_id: String,
    attachments: Vec<MailAttachment>,
}

const CAP: usize = 2_000_000; // bytes of body kept; the rest is cut

fn cap(s: &str) -> String {
    let mut end = s.len().min(CAP);
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

fn addrs(a: Option<&Address>) -> Vec<MailAddr> {
    a.map(|a| {
        a.iter()
            .filter_map(|x| Some(MailAddr { name: x.name().unwrap_or("").into(), address: x.address()?.into() }))
            .collect()
    })
    .unwrap_or_default()
}

/// Parses one raw RFC 822 message. Pure; the HTML is returned UNSANITIZED
/// (the TS sanitizer is the only thing allowed to prepare it for display).
pub fn parse_body(raw: &[u8]) -> Option<MailBody> {
    let m = MessageParser::default().parse(raw)?;
    let text = m.text_bodies().find(|p| !p.is_text_html()).and_then(|p| p.text_contents()).map(cap);
    let html = m.html_bodies().find(|p| p.is_text_html()).and_then(|p| p.text_contents()).map(cap);
    let attachments = m
        .attachments()
        .map(|p| MailAttachment {
            name: p.attachment_name().unwrap_or("attachment").to_string(),
            mime: p
                .content_type()
                .map(|c| format!("{}/{}", c.ctype(), c.subtype().unwrap_or("octet-stream")))
                .unwrap_or_else(|| "application/octet-stream".into()),
            size: p.len(),
        })
        .collect();
    Some(MailBody {
        text,
        html,
        from: addrs(m.from()),
        to: addrs(m.to()),
        cc: addrs(m.cc()),
        reply_to: addrs(m.reply_to()),
        message_id: m.message_id().unwrap_or("").to_string(),
        attachments,
    })
}

/// Fetches one message by UID (PEEK: does not set \Seen) and parses it.
#[tauri::command]
pub async fn mail_fetch_message(acct: MailAcct, folder: String, uid: u32) -> Result<MailBody, String> {
    blocking(move || {
        let mut s = connect(&acct)?;
        s.select(&folder).map_err(|e| e.to_string())?;
        let fetched = s.uid_fetch(uid.to_string(), "BODY.PEEK[]").map_err(|e| e.to_string())?;
        let raw = fetched.iter().find_map(|f| f.body()).ok_or("message not found on server")?;
        let parsed = parse_body(raw).ok_or("could not parse message")?;
        drop(fetched);
        s.logout().ok();
        Ok(parsed)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIME: &[u8] = b"From: A <a@x.com>\r\nTo: b@x.com\r\nSubject: t\r\nMessage-ID: <1@x>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"B\"\r\n\r\n--B\r\nContent-Type: multipart/alternative; boundary=\"C\"\r\n\r\n--C\r\nContent-Type: text/plain\r\n\r\nplain body\r\n--C\r\nContent-Type: text/html\r\n\r\n<p onclick=x>html body</p>\r\n--C--\r\n--B\r\nContent-Type: application/pdf; name=\"f.pdf\"\r\nContent-Disposition: attachment; filename=\"f.pdf\"\r\nContent-Transfer-Encoding: base64\r\n\r\nSGVsbG8=\r\n--B--\r\n";

    #[test]
    fn splits_text_html_and_attachments() {
        let b = parse_body(MIME).unwrap();
        assert_eq!(b.text.as_deref().map(str::trim), Some("plain body"));
        assert!(b.html.unwrap().contains("html body"));
        assert_eq!(b.attachments.len(), 1);
        assert_eq!(b.attachments[0].name, "f.pdf");
        assert_eq!(b.attachments[0].mime, "application/pdf");
        assert_eq!(b.attachments[0].size, 5);
        assert_eq!(b.message_id, "1@x");
        assert_eq!(b.from[0].address, "a@x.com");
    }
}
