// Runs a fixed system program with fixed (or validated) arguments, no shell, no window, output as text.
// Every PC Care helper that shells out goes through here so nothing can inject a shell string.
use std::process::{Command, Stdio};

pub fn run_fixed(prog: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new(prog);
    cmd.args(args).stdin(Stdio::null()).env("GIT_TERMINAL_PROMPT", "0");
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000);
    let out = cmd.output().map_err(|e| format!("couldn't run {prog}: {e}"))?;
    if !out.status.success() && out.stdout.is_empty() {
        return Err(format!("{prog} failed: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Splits "Key   : value" lines (netsh / powercfg / ipconfig style); keys trimmed.
pub fn kv_lines(text: &str) -> Vec<(String, String)> {
    text.lines()
        .filter_map(|l| {
            let (k, v) = l.split_once(':')?;
            let k = k.trim().trim_end_matches(['.', ' ']).trim();
            if k.is_empty() { None } else { Some((k.to_string(), v.trim().to_string())) }
        })
        .collect()
}

pub async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn kv_parses_dotted_keys() {
        let v = kv_lines("   Default Gateway . . . . . . . . . : 192.168.1.1\nnoise\n SSID : home");
        assert_eq!(v[0], ("Default Gateway".into(), "192.168.1.1".into()));
        assert_eq!(v[1], ("SSID".into(), "home".into()));
    }
}
