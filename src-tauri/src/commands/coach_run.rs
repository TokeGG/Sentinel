// Runs the owner's puzzle code with THEIR installed python/node: only when they press Run in the Coach. Code goes to a
// temp file, stdin is the puzzle input, no shell, killed after a timeout, output capped. Neither interpreter has a
// portable no-network switch, so none is claimed; python runs isolated (-I), node with an emptied environment.
use serde::Serialize;
use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

pub const MAX_OUT: usize = 8000;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RunOut { pub stdout: String, pub stderr: String, pub code: Option<i32>, pub timed_out: bool, pub truncated: bool }

pub fn cap(bytes: &[u8], max: usize) -> (String, bool) {
    let s = String::from_utf8_lossy(bytes);
    if s.chars().count() <= max { return (s.into_owned(), false); }
    (s.chars().take(max).collect(), true)
}

pub fn program(lang: &str) -> Result<(&'static str, &'static [&'static str], &'static str), String> {
    match lang {
        "python" => Ok((if cfg!(windows) { "python" } else { "python3" }, &["-I"], "py")),
        "javascript" => Ok(("node", &[], "js")),
        _ => Err("language must be python or javascript".into()),
    }
}

fn run(lang: &str, code: &str, stdin: &str, timeout: Duration) -> Result<RunOut, String> {
    let (prog, flags, ext) = program(lang)?;
    let path = std::env::temp_dir().join(format!("sentinel-coach-{}-{}.{ext}", std::process::id(), Instant::now().elapsed().as_nanos() ^ rand_tag()));
    std::fs::write(&path, code).map_err(|e| e.to_string())?;
    let mut cmd = Command::new(prog);
    cmd.args(flags).arg(&path).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).current_dir(std::env::temp_dir());
    if lang == "javascript" { cmd.env_clear().env("PATH", std::env::var("PATH").unwrap_or_default()); }
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000);
    let mut child = cmd.spawn().map_err(|e| { let _ = std::fs::remove_file(&path); format!("couldn't start {prog} (is it installed and on PATH?): {e}") })?;
    let input = stdin.as_bytes().to_vec();
    let mut w = child.stdin.take();
    std::thread::spawn(move || { if let Some(s) = w.as_mut() { let _ = s.write_all(&input); } });
    let (mut so, mut se) = (child.stdout.take().unwrap(), child.stderr.take().unwrap());
    let ro = std::thread::spawn(move || { let mut b = Vec::new(); let _ = so.by_ref().take(1 << 20).read_to_end(&mut b); b });
    let re = std::thread::spawn(move || { let mut b = Vec::new(); let _ = se.by_ref().take(1 << 20).read_to_end(&mut b); b });
    let start = Instant::now();
    let (code, timed_out) = loop {
        if let Some(st) = child.try_wait().map_err(|e| e.to_string())? { break (st.code(), false); }
        if start.elapsed() > timeout { let _ = child.kill(); let _ = child.wait(); break (None, true); }
        std::thread::sleep(Duration::from_millis(25));
    };
    let _ = std::fs::remove_file(&path);
    let (stdout, a) = cap(&ro.join().unwrap_or_default(), MAX_OUT);
    let (stderr, b) = cap(&re.join().unwrap_or_default(), MAX_OUT / 2);
    Ok(RunOut { stdout, stderr, code, timed_out, truncated: a || b })
}

fn rand_tag() -> u128 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0) }

#[tauri::command]
pub async fn coach_run_code(lang: String, code: String, stdin: String, timeout_secs: u64) -> Result<RunOut, String> {
    if code.len() > 200_000 || stdin.len() > 4_000_000 { return Err("code or input too large".into()); }
    let t = Duration::from_secs(timeout_secs.clamp(1, 30));
    super::pc_cmd::blocking(move || run(&lang, &code, &stdin, t)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn caps_and_langs() {
        assert_eq!(cap(b"hello", 10), ("hello".into(), false));
        assert_eq!(cap(b"hello", 3), ("hel".into(), true));
        assert!(program("ruby").is_err() && program("python").is_ok());
    }
    #[test]
    fn runs_with_timeout_if_python_present() {
        if Command::new("python3").arg("-V").output().is_err() { return; }
        let r = run("python", "import sys\nprint(sum(int(x) for x in sys.stdin))", "1\n2\n", Duration::from_secs(5)).unwrap();
        assert_eq!(r.stdout.trim(), "3");
        let t = run("python", "while True: pass", "", Duration::from_millis(300)).unwrap();
        assert!(t.timed_out);
        let big = run("python", "print('x'*20000)", "", Duration::from_secs(5)).unwrap();
        assert!(big.truncated && big.stdout.len() == MAX_OUT);
    }
}
