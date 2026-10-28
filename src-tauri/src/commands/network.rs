use serde::Serialize;

#[derive(Serialize)]
pub struct NetDevice {
    ip: String,
    mac: String,
}

// Passive: reads the OS's own ARP cache (`arp -a`) — devices this machine has
// already talked to, no raw sockets, no admin rights, no new driver. An
// active sweep of the whole subnet is a possible later upgrade but needs
// raw-socket access (Npcap on Windows, which needs admin) — out of scope for
// this first pass.
#[tauri::command]
pub fn get_network_devices() -> Result<Vec<NetDevice>, String> {
    let output = std::process::Command::new("arp")
        .arg("-a")
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout);

    let ip_re = regex_lite::Regex::new(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})").unwrap();
    let mac_re = regex_lite::Regex::new(r"([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}").unwrap();

    let mut devices = Vec::new();
    for line in text.lines() {
        let ip = ip_re.find(line).map(|m| m.as_str().to_string());
        let mac = mac_re.find(line).map(|m| m.as_str().to_string());
        if let (Some(ip), Some(mac)) = (ip, mac) {
            devices.push(NetDevice { ip, mac });
        }
    }
    Ok(devices)
}

