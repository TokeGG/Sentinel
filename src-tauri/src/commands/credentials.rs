// OS-keychain credential helper (Foundation item, deferred until a module
// actually needed a real secret — GitHub Discovery and YouTube both do now).
// Every secret a module needs — a PAT, an OAuth client secret, an IMAP
// password — goes through here and only here. Nothing is ever written to
// SQLite or any plaintext file; "service" is the module id so one module
// can never read another's secret.
const KEYRING_APP: &str = "com.sentinel.app";

#[tauri::command]
pub fn set_credential(service: String, key: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_APP, &format!("{service}:{key}"))
        .map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_credential(service: String, key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_APP, &format!("{service}:{key}"))
        .map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_credential(service: String, key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_APP, &format!("{service}:{key}"))
        .map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

