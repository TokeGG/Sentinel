use super::mail::{blocking, connect, MailAcct};

// Server-side message changes. Each is a direct user action in the Email
// panel; moving to Trash and deleting are confirmed there first.

#[tauri::command]
pub async fn mail_set_flag(acct: MailAcct, folder: String, uid: u32, flag: String, on: bool) -> Result<(), String> {
    let name = match flag.as_str() {
        "seen" => "\\Seen",
        "flagged" => "\\Flagged",
        _ => return Err(format!("unknown flag {flag}")),
    };
    blocking(move || {
        let mut s = connect(&acct)?;
        s.select(&folder).map_err(|e| e.to_string())?;
        let sign = if on { '+' } else { '-' };
        s.uid_store(uid.to_string(), format!("{sign}FLAGS.SILENT ({name})")).map_err(|e| e.to_string())?;
        s.logout().ok();
        Ok(())
    })
    .await
}

/// Moves one message; uses UID MOVE, falling back to COPY + \Deleted + EXPUNGE.
#[tauri::command]
pub async fn mail_move(acct: MailAcct, folder: String, uid: u32, dest: String) -> Result<(), String> {
    blocking(move || {
        let mut s = connect(&acct)?;
        s.select(&folder).map_err(|e| e.to_string())?;
        let id = uid.to_string();
        if s.uid_mv(&id, &dest).is_err() {
            s.uid_copy(&id, &dest).map_err(|e| e.to_string())?;
            s.uid_store(&id, "+FLAGS.SILENT (\\Deleted)").map_err(|e| e.to_string())?;
            s.uid_expunge(&id).map_err(|e| e.to_string())?;
        }
        s.logout().ok();
        Ok(())
    })
    .await
}

/// Permanent delete (flag \Deleted + expunge that one UID). The UI only
/// offers it from Trash, after a confirm step that names the message.
#[tauri::command]
pub async fn mail_delete(acct: MailAcct, folder: String, uid: u32) -> Result<(), String> {
    blocking(move || {
        let mut s = connect(&acct)?;
        s.select(&folder).map_err(|e| e.to_string())?;
        let id = uid.to_string();
        s.uid_store(&id, "+FLAGS.SILENT (\\Deleted)").map_err(|e| e.to_string())?;
        s.uid_expunge(&id).map_err(|e| e.to_string())?;
        s.logout().ok();
        Ok(())
    })
    .await
}
