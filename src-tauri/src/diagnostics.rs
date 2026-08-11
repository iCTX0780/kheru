//! Commands the frontend uses to point users at their local log files.
//!
//! `tauri-plugin-log` writes rotating log files under the platform's
//! app-log directory. `log_directory` returns that path so the Settings
//! "Diagnostics" section can display + copy it; `reveal_log_directory`
//! opens the folder in Finder / Explorer / the Linux file manager so a
//! user can attach logs to a bug report in one click.

use tauri::Manager;

fn app_log_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    // The dir doesn't exist until the plugin has written its first line —
    // create it eagerly so "reveal" doesn't error on a fresh install.
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    Ok(dir)
}

#[tauri::command]
pub fn log_directory(app: tauri::AppHandle) -> Result<String, String> {
    Ok(app_log_path(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn reveal_log_directory(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app_log_path(&app)?;
    let path_str = dir.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    let cmd = std::process::Command::new("open").arg(&dir).spawn();
    #[cfg(target_os = "windows")]
    let cmd = std::process::Command::new("explorer").arg(&dir).spawn();
    #[cfg(target_os = "linux")]
    let cmd = std::process::Command::new("xdg-open").arg(&dir).spawn();

    cmd.map_err(|e| format!("failed to open log directory: {e}"))?;
    Ok(path_str)
}
