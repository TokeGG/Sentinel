// clone_repo: shells out to the system `git`, nothing more — "install" in
// GitHub Discovery means clone-to-folder, never executing the repo's code.
#[tauri::command]
pub fn clone_repo(url: String, dest_dir: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(["clone", &url])
        .current_dir(&dest_dir)
        .output()
        .map_err(|e| format!("couldn't run git: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).into_owned());
    }
    Ok(dest_dir)
}

