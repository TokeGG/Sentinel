// Own-PC listening-ports audit: parses `netstat -ano` (Windows) / `netstat -tuln` (elsewhere). Read-only.
use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System};

#[derive(Serialize, Debug, PartialEq)]
pub struct Listen { proto: String, addr: String, port: u16, pid: Option<u32>, process: Option<String> }

pub fn parse_netstat(text: &str) -> Vec<Listen> {
    let mut out = Vec::new();
    for l in text.lines() {
        let f: Vec<&str> = l.split_whitespace().collect();
        if f.len() < 4 { continue }
        let proto = f[0].to_lowercase();
        if !proto.starts_with("tcp") && !proto.starts_with("udp") { continue }
        let linux = f[1].parse::<u64>().is_ok();
        let local = if linux { f[3] } else { f[1] };
        let listening = l.contains("LISTEN") || proto.starts_with("udp");
        if !listening { continue }
        let Some((addr, port)) = local.rsplit_once(':') else { continue };
        let Ok(port) = port.parse::<u16>() else { continue };
        let pid = if linux { None } else { f.last().and_then(|p| p.parse().ok()) };
        out.push(Listen { proto, addr: addr.trim_matches(['[', ']']).to_string(), port, pid, process: None });
    }
    out.sort_by(|a, b| a.port.cmp(&b.port).then(a.proto.cmp(&b.proto)));
    out.dedup();
    out
}

#[tauri::command]
pub async fn listening_ports() -> Result<Vec<Listen>, String> {
    super::pc_cmd::blocking(|| {
        let args: &[&str] = if cfg!(windows) { &["-ano"] } else { &["-tuln"] };
        let mut v = parse_netstat(&super::pc_cmd::run_fixed("netstat", args)?);
        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::All, false);
        for l in &mut v {
            l.process = l.pid.and_then(|p| sys.process(Pid::from_u32(p))).map(|p| p.name().to_string_lossy().into_owned());
        }
        Ok(v)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn windows_and_linux_rows() {
        let w = "  Proto  Local Address  Foreign Address  State  PID\n  TCP    0.0.0.0:135    0.0.0.0:0   LISTENING   1048\n  TCP    10.0.0.2:5000  1.2.3.4:443 ESTABLISHED 77\n  TCP    [::]:445       [::]:0      LISTENING   4\n";
        let v = parse_netstat(w);
        assert_eq!(v.len(), 2);
        assert_eq!((v[0].port, v[0].pid), (135, Some(1048)));
        assert_eq!(v[1].addr, "::");
        let l = "tcp        0      0 127.0.0.1:631    0.0.0.0:*     LISTEN\n";
        assert_eq!(parse_netstat(l)[0].port, 631);
    }
}
