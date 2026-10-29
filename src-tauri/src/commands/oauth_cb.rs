// Pure parsing of one loopback redirect request line (see oauth.rs).
#[derive(Debug, PartialEq)]
pub enum Cb {
    /// Not our callback (favicon, wrong path/method, stale or forged state): answer 404/400, keep waiting.
    Ignore,
    /// `?code=` on the right path with the expected state.
    Code(String),
    /// `?error=` (e.g. access_denied) on the right path with the expected state.
    Denied(String),
}

fn pct(s: &str) -> String {
    let b = s.as_bytes();
    let (mut out, mut i) = (Vec::new(), 0);
    while i < b.len() {
        match b[i] {
            b'+' => out.push(b' '),
            b'%' if i + 2 < b.len() && (b[i + 1] as char).is_ascii_hexdigit() && (b[i + 2] as char).is_ascii_hexdigit() => {
                out.push(u8::from_str_radix(&s[i + 1..i + 3], 16).unwrap());
                i += 2;
            }
            c => out.push(c),
        }
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// `first_line` is e.g. `GET /callback?code=x&state=y HTTP/1.1`. `state` of None skips the check.
pub fn parse_callback(first_line: &str, path: &str, state: Option<&str>) -> Cb {
    let mut it = first_line.split_whitespace();
    if it.next() != Some("GET") {
        return Cb::Ignore;
    }
    let target = it.next().unwrap_or("");
    let (p, q) = target.split_once('?').unwrap_or((target, ""));
    if p != path {
        return Cb::Ignore;
    }
    let (mut code, mut err, mut st) = (None, None, None);
    for kv in q.split('&') {
        let (k, v) = kv.split_once('=').unwrap_or((kv, ""));
        match k {
            "code" => code = Some(pct(v)),
            "error" => err = Some(pct(v)),
            "state" => st = Some(pct(v)),
            _ => {}
        }
    }
    if state.is_some() && st.as_deref() != state {
        return Cb::Ignore;
    }
    match (err, code) {
        (Some(e), _) => Cb::Denied(e),
        (None, Some(c)) if !c.is_empty() => Cb::Code(c),
        _ => Cb::Ignore,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const L: &str = "GET /callback?code=ab%2Fc&state=S1 HTTP/1.1";

    #[test]
    fn accepts_code_and_decodes_it() {
        assert_eq!(parse_callback(L, "/callback", Some("S1")), Cb::Code("ab/c".into()));
    }
    #[test]
    fn state_mismatch_or_missing_is_ignored() {
        assert_eq!(parse_callback(L, "/callback", Some("S2")), Cb::Ignore);
        assert_eq!(parse_callback("GET /callback?code=x HTTP/1.1", "/callback", Some("S1")), Cb::Ignore);
    }
    #[test]
    fn access_denied_is_reported() {
        let l = "GET /callback?error=access_denied&state=S1 HTTP/1.1";
        assert_eq!(parse_callback(l, "/callback", Some("S1")), Cb::Denied("access_denied".into()));
    }
    #[test]
    fn favicon_wrong_path_wrong_method_and_empty_are_ignored() {
        assert_eq!(parse_callback("GET /favicon.ico HTTP/1.1", "/callback", Some("S1")), Cb::Ignore);
        assert_eq!(parse_callback("POST /callback?code=x&state=S1 HTTP/1.1", "/callback", Some("S1")), Cb::Ignore);
        assert_eq!(parse_callback("GET /callback HTTP/1.1", "/callback", None), Cb::Ignore);
        assert_eq!(parse_callback("", "/", None), Cb::Ignore);
    }
}
