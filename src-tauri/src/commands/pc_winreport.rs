// Read-only Windows reports: pending updates / problem devices (best effort), app permission audit
// (CapabilityAccessManager consent store) and Wi-Fi (netsh; saved keys are never requested).
use super::pc_cmd::{blocking, kv_lines, run_fixed};
use serde::Serialize;

const CONSENT: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore";
const PS_UPDATES: &str = "$s=(New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher();$s.Search('IsInstalled=0 and IsHidden=0').Updates|ForEach-Object{$_.Title}";

#[derive(Serialize, Debug, PartialEq)]
pub struct Consent { capability: String, app: String, allowed: bool }

fn win() -> Result<(), String> { if cfg!(windows) { Ok(()) } else { Err("Windows-only".into()) } }

/// `reg query <ConsentStore>\<cap> /s` -> one row per app key that has a Value.
pub fn parse_consent(cap: &str, text: &str) -> Vec<Consent> {
    let mut out = Vec::new();
    let mut app = String::new();
    for l in text.lines() {
        if l.starts_with("HKEY_") { app = l.rsplit('\\').next().unwrap_or("").replace('#', "\\"); continue }
        let t = l.trim();
        if let Some(v) = t.strip_prefix("Value") {
            let allowed = v.trim().ends_with("Allow");
            out.push(Consent { capability: cap.into(), app: if app == cap { "(global switch)".into() } else { app.clone() }, allowed });
        }
    }
    out
}

/// Drops any line that could carry a Wi-Fi key, even if netsh ever printed one unasked.
pub fn safe_kv(text: &str) -> Vec<(String, String)> {
    kv_lines(text).into_iter().filter(|(k, _)| !k.to_lowercase().contains("key content")).collect()
}

#[tauri::command]
pub async fn permission_audit() -> Result<Vec<Consent>, String> {
    win()?;
    blocking(|| {
        let mut v = Vec::new();
        for cap in ["microphone", "webcam", "location"] {
            if let Ok(t) = run_fixed("reg", &["query", &format!(r"{CONSENT}\{cap}"), "/s"]) { v.extend(parse_consent(cap, &t)) }
        }
        Ok(v)
    }).await
}

#[tauri::command]
pub async fn wifi_report() -> Result<(Vec<(String, String)>, Vec<String>), String> {
    win()?;
    blocking(|| {
        let iface = safe_kv(&run_fixed("netsh", &["wlan", "show", "interfaces"])?);
        let profiles = kv_lines(&run_fixed("netsh", &["wlan", "show", "profiles"]).unwrap_or_default())
            .into_iter().filter(|(k, _)| k.contains("Profile")).map(|(_, v)| v).filter(|v| !v.is_empty()).collect();
        Ok((iface, profiles))
    }).await
}

/// (pending update titles, devices with a problem). Either may error out on locked-down machines.
#[tauri::command]
pub async fn pending_updates() -> Result<(Vec<String>, Vec<String>), String> {
    win()?;
    blocking(|| {
        let ups = run_fixed("powershell", &["-NoProfile", "-NonInteractive", "-Command", PS_UPDATES])?;
        let devs = run_fixed("pnputil", &["/enum-devices", "/problem"]).unwrap_or_default();
        let problems = kv_lines(&devs).into_iter().filter(|(k, _)| k == "Device Description").map(|(_, v)| v).collect();
        Ok((ups.lines().map(str::trim).filter(|l| !l.is_empty()).map(String::from).collect(), problems))
    }).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn consent_and_wifi() {
        let t = "HKEY_CURRENT_USER\\x\\ConsentStore\\webcam\n    Value    REG_SZ    Allow\n\nHKEY_CURRENT_USER\\x\\ConsentStore\\webcam\\NonPackaged\\C:#Apps#zoom.exe\n    LastUsedTimeStart    REG_QWORD    0x1\n    Value    REG_SZ    Deny\n";
        let c = parse_consent("webcam", t);
        assert_eq!(c.len(), 2);
        assert_eq!(c[0].app, "(global switch)");
        assert_eq!(c[1].app, "C:\\Apps\\zoom.exe");
        assert!(c[0].allowed && !c[1].allowed);
        let w = safe_kv("    SSID : home\n    Key Content : hunter2\n");
        assert_eq!(w, vec![("SSID".to_string(), "home".to_string())]);
    }
}
