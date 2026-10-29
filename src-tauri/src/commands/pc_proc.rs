// Process viewer (read-only list + kill after the panel's confirm) and temperature sensors.
use serde::Serialize;
use sysinfo::{Components, Pid, ProcessesToUpdate, System};

#[derive(Serialize)]
pub struct Proc { pid: u32, name: String, cpu: f32, mem_mb: u64 }

#[derive(Serialize)]
pub struct Sensor { label: String, temp: Option<f32>, max: Option<f32>, critical: Option<f32> }

#[tauri::command]
pub async fn list_processes() -> Result<Vec<Proc>, String> {
    super::pc_cmd::blocking(|| {
        let mut sys = System::new();
        sys.refresh_processes(ProcessesToUpdate::All, true);
        std::thread::sleep(std::time::Duration::from_millis(250));
        sys.refresh_processes(ProcessesToUpdate::All, true);
        let mut v: Vec<Proc> = sys
            .processes()
            .iter()
            .map(|(pid, p)| Proc { pid: pid.as_u32(), name: p.name().to_string_lossy().into_owned(), cpu: p.cpu_usage(), mem_mb: p.memory() / 1024 / 1024 })
            .collect();
        v.sort_by(|a, b| b.mem_mb.cmp(&a.mem_mb));
        Ok(v)
    })
    .await
}

/// Refuses our own pid and pids 0/4 (Windows Idle/System); the name must still match what was confirmed.
pub fn kill_allowed(pid: u32, own: u32) -> bool { pid > 4 && pid != own }

#[tauri::command]
pub fn kill_process(pid: u32, name: String) -> Result<(), String> {
    if !kill_allowed(pid, std::process::id()) { return Err("refusing to end that process".into()) }
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);
    let p = sys.process(Pid::from_u32(pid)).ok_or("process already ended")?;
    if p.name().to_string_lossy() != name { return Err("pid now belongs to another program; nothing ended".into()) }
    if p.kill() { Ok(()) } else { Err("the OS refused (may need admin)".into()) }
}

/// Empty list = this machine exposes no sensors to sysinfo (common on Windows without admin/WMI).
#[tauri::command]
pub fn list_sensors() -> Vec<Sensor> {
    Components::new_with_refreshed_list()
        .iter()
        .map(|c| Sensor { label: c.label().to_string(), temp: c.temperature(), max: c.max(), critical: c.critical() })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn kill_guard() {
        assert!(!kill_allowed(0, 99));
        assert!(!kill_allowed(4, 99));
        assert!(!kill_allowed(99, 99));
        assert!(kill_allowed(1234, 99));
    }
}
