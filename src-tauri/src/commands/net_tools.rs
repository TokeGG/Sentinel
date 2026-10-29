// Home Network helpers: wake-on-LAN magic packet, ping (system `ping`, validated IPv4), default gateway.
use super::pc_cmd::{blocking, run_fixed};
use std::net::{Ipv4Addr, UdpSocket};

/// 6 x 0xFF then the MAC 16 times (102 bytes).
pub fn magic_packet(mac: &str) -> Result<Vec<u8>, String> {
    let hex: String = mac.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    let sep_ok = mac.chars().all(|c| c.is_ascii_hexdigit() || c == ':' || c == '-');
    if hex.len() != 12 || !sep_ok { return Err("not a MAC address".into()) }
    let bytes: Vec<u8> = (0..6).map(|i| u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).unwrap()).collect();
    let mut p = vec![0xFFu8; 6];
    for _ in 0..16 { p.extend_from_slice(&bytes) }
    Ok(p)
}

#[tauri::command]
pub fn wake_on_lan(mac: String) -> Result<(), String> {
    let p = magic_packet(&mac)?;
    let s = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    s.set_broadcast(true).map_err(|e| e.to_string())?;
    s.send_to(&p, "255.255.255.255:9").map_err(|e| e.to_string())?;
    Ok(())
}

/// Pings each IPv4 once (1 s timeout). Anything that isn't a plain IPv4 is reported down, never passed on.
#[tauri::command]
pub async fn ping_hosts(ips: Vec<String>) -> Result<Vec<(String, bool)>, String> {
    blocking(move || Ok(ips.into_iter().take(256).map(|ip| {
        let up = ip.parse::<Ipv4Addr>().is_ok() && {
            let args: &[&str] = if cfg!(windows) { &["-n", "1", "-w", "1000", &ip] } else { &["-c", "1", "-W", "1", &ip] };
            run_fixed("ping", args).map(|t| reply_ok(&t)).unwrap_or(false)
        };
        (ip, up)
    }).collect())).await
}

pub fn reply_ok(t: &str) -> bool { t.contains("TTL=") || t.contains("ttl=") }

/// "Default Gateway . . : 192.168.1.1" (ipconfig) or "default via 192.168.1.1" (ip route).
pub fn parse_gateway(t: &str) -> Option<String> {
    let re = regex_lite::Regex::new(r"(?:Default Gateway[ .]*:\s*|default via\s+)(\d{1,3}(?:\.\d{1,3}){3})").unwrap();
    t.lines().filter_map(|l| re.captures(l)).map(|c| c[1].to_string()).find(|ip| ip.parse::<Ipv4Addr>().is_ok())
}

#[tauri::command]
pub async fn default_gateway() -> Result<Option<String>, String> {
    blocking(|| {
        let t = if cfg!(windows) { run_fixed("ipconfig", &[])? } else { run_fixed("ip", &["route"])? };
        Ok(parse_gateway(&t))
    }).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn packet_and_parsers() {
        let p = magic_packet("AA:bb-cc:00:11:22").unwrap();
        assert_eq!(p.len(), 102);
        assert_eq!(&p[..6], &[0xFF; 6]);
        assert_eq!(&p[6..12], &[0xAA, 0xBB, 0xCC, 0, 0x11, 0x22]);
        assert_eq!(&p[96..102], &p[6..12]);
        assert!(magic_packet("zz:zz").is_err() && magic_packet("aa:bb:cc:dd:ee:ff;rm").is_err());
        assert_eq!(parse_gateway("   Default Gateway . . . . : 192.168.1.1").as_deref(), Some("192.168.1.1"));
        assert_eq!(parse_gateway("default via 10.0.0.1 dev eth0").as_deref(), Some("10.0.0.1"));
        assert!(parse_gateway("Default Gateway . . :").is_none());
        assert!(reply_ok("Reply from 1.1.1.1: bytes=32 time=3ms TTL=57") && !reply_ok("Request timed out."));
    }
}
