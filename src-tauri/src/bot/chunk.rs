//! Title-channel framing. A result travels from the page as a series of
//! `document.title` values `__SB__<nonce>:<id>:<seq>/<n>:<base64>` (JS side in
//! script.rs); this decodes and reassembles them. Pure, no Tauri.
use base64::{engine::general_purpose::STANDARD, Engine};
use std::collections::HashMap;

pub const PREFIX: &str = "__SB__";
pub const MAX_CHUNKS: usize = 600;
pub const MAX_BYTES: usize = 4 * 1024 * 1024;
const MAX_IN_FLIGHT: usize = 16;

#[derive(Debug, PartialEq)]
pub struct Chunk {
    pub id: String,
    pub seq: usize,
    pub total: usize,
    pub data: String,
}

/// A title that is one of our chunks for this nonce; anything else (the page's own titles, forged nonces) is None.
pub fn decode(nonce: &str, title: &str) -> Option<Chunk> {
    let rest = title.strip_prefix(PREFIX)?.strip_prefix(nonce)?.strip_prefix(':')?;
    let mut it = rest.splitn(3, ':');
    let (id, pos, data) = (it.next()?, it.next()?, it.next()?);
    let (seq, total) = pos.split_once('/')?;
    let (seq, total): (usize, usize) = (seq.parse().ok()?, total.parse().ok()?);
    let ok_id = !id.is_empty() && id.len() <= 64 && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_');
    let ok_data = data.bytes().all(|c| c.is_ascii_alphanumeric() || matches!(c, b'+' | b'/' | b'='));
    (ok_id && ok_data && total >= 1 && total <= MAX_CHUNKS && seq < total).then(|| Chunk { id: id.into(), seq, total, data: data.into() })
}

#[derive(Default)]
pub struct Reassembler {
    parts: HashMap<String, (usize, Vec<Option<String>>)>,
}

impl Reassembler {
    /// Feed one chunk; Some(Ok(bytes)) when its message is complete, Some(Err) when it is unusable (and dropped).
    pub fn push(&mut self, c: Chunk) -> Option<Result<Vec<u8>, String>> {
        if !self.parts.contains_key(&c.id) && self.parts.len() >= MAX_IN_FLIGHT {
            self.parts.clear(); // a flood of half messages: start over rather than grow
        }
        let e = self.parts.entry(c.id.clone()).or_insert_with(|| (c.total, vec![None; c.total]));
        if e.0 != c.total {
            self.parts.remove(&c.id);
            return Some(Err("chunk count changed".into()));
        }
        e.1[c.seq] = Some(c.data);
        if e.1.iter().any(Option::is_none) {
            return None;
        }
        let joined: String = self.parts.remove(&c.id)?.1.into_iter().flatten().collect();
        if joined.len() / 4 * 3 > MAX_BYTES {
            return Some(Err("result too large".into()));
        }
        Some(STANDARD.decode(joined).map_err(|e| format!("bad base64: {e}")))
    }
    pub fn forget(&mut self, id: &str) {
        self.parts.remove(id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    /// Titles for `payload`, `size` base64 characters per title (used by tests; the page has its own JS encoder).
    fn encode(nonce: &str, id: &str, payload: &[u8], size: usize) -> Vec<String> {
        let b64 = STANDARD.encode(payload);
        let parts: Vec<&str> = if b64.is_empty() { vec![""] } else { b64.as_bytes().chunks(size.max(1)).map(|c| std::str::from_utf8(c).unwrap_or("")).collect() };
        let n = parts.len();
        parts.iter().enumerate().map(|(i, p)| format!("{PREFIX}{nonce}:{id}:{i}/{n}:{p}")).collect()
    }
    fn feed(r: &mut Reassembler, titles: &[String]) -> Option<Result<Vec<u8>, String>> {
        titles.iter().filter_map(|t| decode("n1", t)).filter_map(|c| r.push(c)).last()
    }
    #[test]
    fn roundtrip_single_and_many_chunks() {
        let mut r = Reassembler::default();
        for (payload, size) in [("{}".as_bytes(), 100), ("héllo wörld ✓ {\"a\":[1,2,3]}".as_bytes(), 4), (&b""[..], 8)] {
            let t = encode("n1", "id-1", payload, size);
            assert_eq!(feed(&mut r, &t), Some(Ok(payload.to_vec())));
        }
    }
    #[test]
    fn out_of_order_and_duplicates_reassemble() {
        let mut t = encode("n1", "a", b"0123456789abcdef", 4);
        t.reverse();
        t.push(t[0].clone());
        let mut r = Reassembler::default();
        assert_eq!(feed(&mut r, &t[..t.len() - 1]), Some(Ok(b"0123456789abcdef".to_vec())));
    }
    #[test]
    fn interleaved_ids_stay_apart() {
        let (a, b) = (encode("n1", "a", b"AAAAAAAA", 4), encode("n1", "b", b"BBBBBBBB", 4));
        let mut r = Reassembler::default();
        let mut done = vec![];
        for t in a.iter().zip(b.iter()).flat_map(|(x, y)| [x, y]) {
            if let Some(Ok(v)) = r.push(decode("n1", t).unwrap()) {
                done.push(v);
            }
        }
        assert_eq!(done, vec![b"AAAAAAAA".to_vec(), b"BBBBBBBB".to_vec()]);
    }
    #[test]
    fn foreign_titles_are_ignored() {
        assert_eq!(decode("n1", "My page"), None);
        assert_eq!(decode("n1", "__SB__bad:id:0/1:QQ=="), None, "wrong nonce");
        for bad in ["__SB__n1:id:1/1:QQ==", "__SB__n1:id:0/0:QQ==", "__SB__n1:id:0/9999:QQ==", "__SB__n1:i d:0/1:QQ==", "__SB__n1:id:0/1:<b>", "__SB__n1:id:x/1:QQ==", "__SB__n1:id:0/1"] {
            assert_eq!(decode("n1", bad), None, "{bad}");
        }
    }
    #[test]
    fn inconsistent_total_and_bad_base64_are_errors() {
        let mut r = Reassembler::default();
        assert!(r.push(decode("n1", "__SB__n1:x:0/2:QQ==").unwrap()).is_none());
        assert!(matches!(r.push(decode("n1", "__SB__n1:x:1/3:QQ==").unwrap()), Some(Err(_))));
        assert!(matches!(r.push(decode("n1", "__SB__n1:y:0/1:A").unwrap()), Some(Err(_))));
    }
    #[test]
    fn flood_of_half_messages_is_bounded() {
        let mut r = Reassembler::default();
        for i in 0..100 {
            r.push(decode("n1", &format!("__SB__n1:m{i}:0/2:QQ==")).unwrap());
        }
        assert!(r.parts.len() <= MAX_IN_FLIGHT);
    }
}
