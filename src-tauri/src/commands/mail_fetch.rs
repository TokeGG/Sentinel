use super::mail::{blocking, connect, MailAcct};
use mail_parser::{Address, MessageParser, MimeHeaders};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailHeader {
    uid: u32,
    from_name: String,
    from_addr: String,
    to: String,
    subject: String,
    date_ts: i64,
    preview: String,
    seen: bool,
    starred: bool,
    answered: bool,
    has_attach: bool,
}

#[derive(Serialize)]
pub struct MailPage {
    total: u32,
    headers: Vec<MailHeader>,
}

fn first_of(a: Option<&Address>) -> (String, String) {
    let f = a.and_then(|a| a.first());
    let name = f.and_then(|x| x.name()).unwrap_or("").to_string();
    (name, f.and_then(|x| x.address()).unwrap_or("").to_string())
}

/// Decodes one message's header block plus a leading slice of its body
/// (RFC 2047 words, charsets and transfer encodings handled by mail-parser).
pub fn parse_header(uid: u32, flags: (bool, bool, bool), hdr: &[u8], text: &[u8], internal_ts: i64) -> MailHeader {
    let raw = [hdr, text].concat();
    let m = MessageParser::default().parse(&raw);
    let (from_name, from_addr) = first_of(m.as_ref().and_then(|m| m.from()));
    let to = m
        .as_ref()
        .and_then(|m| m.to())
        .map(|a| a.iter().filter_map(|x| x.address()).collect::<Vec<_>>().join(", "))
        .unwrap_or_default();
    let ts = m.as_ref().and_then(|m| m.date()).map(|d| d.to_timestamp()).filter(|t| *t > 0);
    let has_attach = m
        .as_ref()
        .and_then(|m| m.content_type())
        .map(|c| c.ctype().eq_ignore_ascii_case("multipart") && c.subtype().is_some_and(|s| s.eq_ignore_ascii_case("mixed")))
        .unwrap_or(false);
    MailHeader {
        uid,
        from_name,
        from_addr,
        to,
        subject: m.as_ref().and_then(|m| m.subject()).unwrap_or("").to_string(),
        date_ts: ts.unwrap_or(internal_ts),
        preview: m.as_ref().and_then(|m| m.body_preview(160)).map(|p| p.to_string()).unwrap_or_default(),
        seen: flags.0,
        starred: flags.1,
        answered: flags.2,
        has_attach,
    }
}

/// Newest-first page: skips the `offset` newest messages, then takes `limit`.
/// PEEK fetches only, so nothing is marked read.
#[tauri::command]
pub async fn mail_fetch_headers(acct: MailAcct, folder: String, offset: u32, limit: u32) -> Result<MailPage, String> {
    blocking(move || {
        let mut s = connect(&acct)?;
        let total = s.select(&folder).map_err(|e| e.to_string())?.exists;
        let end = total.saturating_sub(offset);
        if end == 0 || limit == 0 {
            s.logout().ok();
            return Ok(MailPage { total, headers: vec![] });
        }
        let start = end.saturating_sub(limit - 1).max(1);
        let fetched = s
            .fetch(format!("{start}:{end}"), "(UID FLAGS INTERNALDATE BODY.PEEK[HEADER] BODY.PEEK[TEXT]<0.700>)")
            .map_err(|e| e.to_string())?;
        let mut headers: Vec<MailHeader> = fetched
            .iter()
            .filter_map(|f| {
                use imap::types::Flag;
                let has = |g: Flag| f.flags().contains(&g);
                let ts = f.internal_date().map(|d| d.timestamp()).unwrap_or(0);
                let flags = (has(Flag::Seen), has(Flag::Flagged), has(Flag::Answered));
                Some(parse_header(f.uid?, flags, f.header()?, f.text().unwrap_or(b""), ts))
            })
            .collect();
        headers.sort_by(|a, b| b.uid.cmp(&a.uid));
        s.logout().ok();
        Ok(MailPage { total, headers })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_encoded_subject_sender_and_preview() {
        let hdr = b"From: =?UTF-8?Q?Jos=C3=A9?= <jose@example.com>\r\nTo: me@example.com\r\nSubject: =?UTF-8?B?SGVsbG8gd29ybGQ=?=\r\nDate: Tue, 1 Oct 2024 10:00:00 +0000\r\nContent-Type: text/plain\r\n\r\n";
        let h = parse_header(7, (true, false, false), hdr, b"Hi there, this is the body.", 0);
        assert_eq!(h.subject, "Hello world");
        assert_eq!(h.from_name, "Jos\u{e9}");
        assert_eq!(h.from_addr, "jose@example.com");
        assert_eq!(h.date_ts, 1727776800);
        assert!(h.preview.starts_with("Hi there"));
        assert!(h.seen && !h.starred && !h.has_attach);
    }

    #[test]
    fn missing_date_falls_back_to_internal_date() {
        let h = parse_header(1, (false, false, false), b"Subject: x\r\n\r\n", b"", 1234);
        assert_eq!(h.date_ts, 1234);
    }
}
