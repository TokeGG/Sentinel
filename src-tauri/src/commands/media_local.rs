// Media helpers: a bounded image reader for the meme-folder viewer (returns a data: URL so no
// asset protocol is needed) and the now-playing probe. Now playing is a stub: the Windows
// GlobalSystemMediaTransportControlsSessionManager needs the `windows` crate (WinRT), which is
// not a dependency; adding it is a separate, Windows-verified change.
use base64::Engine;
use serde::Serialize;
use std::path::PathBuf;

const MAX_IMAGE: u64 = 12 * 1024 * 1024;

pub fn image_mime(name: &str) -> Option<&'static str> {
    let ext = name.rsplit('.').next()?.to_ascii_lowercase();
    Some(match ext.as_str() {
        "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "gif" => "image/gif",
        "webp" => "image/webp", "bmp" => "image/bmp", "avif" => "image/avif",
        _ => return None,
    })
}

/// One image file (absolute path, image extension, at most 12 MB) as a data: URL.
#[tauri::command]
pub async fn read_image_data(path: String) -> Result<String, String> {
    super::pc_cmd::blocking(move || {
        let p = PathBuf::from(&path);
        let mime = image_mime(&path).ok_or("not an image file")?;
        let m = std::fs::metadata(&p).map_err(|e| e.to_string())?;
        if !p.is_absolute() || !m.is_file() { return Err("not a file".into()) }
        if m.len() > MAX_IMAGE { return Err("image is larger than 12 MB".into()) }
        let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
        Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
    }).await
}

#[derive(Serialize)]
pub struct NowPlaying { available: bool, reason: String, title: String, artist: String, app: String, playing: bool }

#[tauri::command]
pub fn now_playing() -> NowPlaying {
    NowPlaying {
        available: false,
        reason: "Windows media session reading is not built yet (needs the WinRT `windows` crate).".into(),
        title: String::new(), artist: String::new(), app: String::new(), playing: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mime_by_extension() {
        assert_eq!(image_mime("a/b.JPG"), Some("image/jpeg"));
        assert_eq!(image_mime("x.webp"), Some("image/webp"));
        assert_eq!(image_mime("x.exe"), None);
        assert_eq!(image_mime("noext"), None);
        assert!(!now_playing().available);
    }
}
