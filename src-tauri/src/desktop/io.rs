//! Read a user-picked text file (encrypted settings import). The path comes
//! from the dialog plugin; size is capped so a wrong pick cannot exhaust memory.
const MAX_BYTES: u64 = 64 * 1024 * 1024;

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_BYTES {
        return Err(format!("file is larger than {} MB", MAX_BYTES / 1024 / 1024));
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
