use serde::Serialize;
use sysinfo::{Disks, System};

#[derive(Serialize)]
pub struct PcMetrics {
    cpu_percent: f32,
    ram_used_mb: u64,
    ram_total_mb: u64,
    disks: Vec<DiskMetric>,
}

#[derive(Serialize)]
pub struct DiskMetric {
    mount: String,
    used_gb: f64,
    total_gb: f64,
}

// Read-only snapshot — PC Care's `get_metrics` skill. No cleanup/write paths
// here; those come later behind an explicit preview-before-apply step.
#[tauri::command]
pub fn get_pc_metrics() -> PcMetrics {
    let mut sys = System::new_all();
    sys.refresh_cpu_usage();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_percent = sys.global_cpu_usage();
    let ram_used_mb = sys.used_memory() / 1024 / 1024;
    let ram_total_mb = sys.total_memory() / 1024 / 1024;

    let disks = Disks::new_with_refreshed_list()
        .iter()
        .map(|d| DiskMetric {
            mount: d.mount_point().to_string_lossy().into_owned(),
            used_gb: (d.total_space() - d.available_space()) as f64 / 1e9,
            total_gb: d.total_space() as f64 / 1e9,
        })
        .collect();

    PcMetrics { cpu_percent, ram_used_mb, ram_total_mb, disks }
}

