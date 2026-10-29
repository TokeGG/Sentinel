use std::cell::Cell;

// XOAUTH2 (Gmail / Microsoft 365). `password` carries a short-lived access
// token that the TS side refreshed for this call; Rust never stores it.
/// The SASL initial response: `user=<u>\x01auth=Bearer <token>\x01\x01`.
pub fn xoauth2_string(user: &str, token: &str) -> String {
    format!("user={user}\x01auth=Bearer {token}\x01\x01")
}

pub struct XOAuth2<'a> {
    user: &'a str,
    token: &'a str,
    sent: Cell<bool>,
}

impl<'a> XOAuth2<'a> {
    pub fn new(user: &'a str, token: &'a str) -> Self {
        Self { user, token, sent: Cell::new(false) }
    }
}

impl imap::Authenticator for XOAuth2<'_> {
    type Response = String;
    /// First call = the token string; a later challenge is the server's JSON
    /// error, which XOAUTH2 answers with an empty line (so the server then
    /// replies NO with the reason instead of hanging).
    fn process(&self, _challenge: &[u8]) -> String {
        if self.sent.replace(true) { String::new() } else { xoauth2_string(self.user, self.token) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use imap::Authenticator;

    #[test]
    fn string_has_the_exact_sasl_shape() {
        assert_eq!(xoauth2_string("a@b.c", "tok"), "user=a@b.c\x01auth=Bearer tok\x01\x01");
    }

    #[test]
    fn base64_matches_the_documented_vector() {
        // Google's XOAUTH2 doc example (someuser@example.com / ya29.vF9dft4qmTc2Nvb3RlckBhdHRhdmlzdGEuY29tCg).
        let s = xoauth2_string("someuser@example.com", "ya29.vF9dft4qmTc2Nvb3RlckBhdHRhdmlzdGEuY29tCg");
        let b = base64::engine::general_purpose::STANDARD.encode(s);
        assert!(b.starts_with("dXNlcj1zb21ldXNlckBleGFtcGxlLmNvbQFhdXRoPUJlYXJlciB5YTI5LnZGOWRmdDRxbVRj"));
        let back = base64::engine::general_purpose::STANDARD.decode(&b).unwrap();
        assert!(back.ends_with(b"\x01\x01") && back.starts_with(b"user=someuser@example.com\x01auth=Bearer "));
    }

    #[test]
    fn answers_error_challenge_with_empty_line() {
        let a = XOAuth2::new("u", "t");
        assert!(a.process(b"").starts_with("user=u"));
        assert_eq!(a.process(b"{\"status\":\"400\"}"), "");
    }
}
