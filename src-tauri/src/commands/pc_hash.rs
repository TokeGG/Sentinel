// File hashing (hash checker + duplicate finder). Streams the file; read-only.
use md5::Md5;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;

fn stream<D: Digest>(path: &Path, mut d: D) -> Result<String, String> {
    let mut f = std::fs::File::open(path).map_err(|e| format!("can't open file: {e}"))?;
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break }
        d.update(&buf[..n]);
    }
    Ok(d.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

pub fn sha256_file(path: &Path) -> Result<String, String> { stream(path, Sha256::new()) }

#[tauri::command]
pub async fn hash_file(path: String, algo: String) -> Result<String, String> {
    super::pc_cmd::blocking(move || {
        let p = Path::new(&path);
        if !p.is_absolute() || !p.is_file() { return Err("pick an existing file".into()) }
        match algo.as_str() {
            "sha256" => sha256_file(p),
            "md5" => stream(p, Md5::new()),
            _ => Err("unknown algorithm".into()),
        }
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn known_digests() {
        let p = std::env::temp_dir().join(format!("sn-hash-{}", std::process::id()));
        std::fs::write(&p, b"abc").unwrap();
        assert_eq!(sha256_file(&p).unwrap(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert_eq!(stream(&p, Md5::new()).unwrap(), "900150983cd24fb0d6963f7d28e17f72");
        std::fs::remove_file(p).ok();
    }
}
