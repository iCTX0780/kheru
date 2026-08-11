pub mod diagnostics;
pub mod tts;

use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

/// Point `phonemize::phonemize` at the espeak-ng we bundle under
/// `resources/espeak-ng/`. In dev (`cargo test`, `tauri:dev` without prior
/// `bundle-espeak`) the resource dir may be empty — that's fine, the
/// phonemizer falls back to `espeak-ng` on PATH.
fn wire_bundled_espeak(app: &tauri::App) {
    let Ok(resource_dir) = app.path().resource_dir() else {
        return;
    };
    let bin = if cfg!(target_os = "windows") {
        resource_dir.join("resources/espeak-ng/bin/espeak-ng.exe")
    } else {
        resource_dir.join("resources/espeak-ng/bin/espeak-ng")
    };
    if !bin.exists() {
        return;
    }
    let data = resource_dir.join("resources/espeak-ng/share/espeak-ng-data");
    let lib = resource_dir.join("resources/espeak-ng/lib");

    std::env::set_var("KHERU_ESPEAK_BIN", &bin);
    if data.exists() {
        std::env::set_var("KHERU_ESPEAK_DATA", &data);
    }
    if lib.exists() {
        std::env::set_var("KHERU_ESPEAK_DYLD", &lib);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            // Local rotating log files under the platform app-log dir plus
            // stdout so `open Kheru.app/Contents/MacOS/kheru` from a terminal
            // still prints. Webview also gets logs forwarded so browser
            // devtools show them in dev.
            tauri_plugin_log::Builder::default()
                .targets([
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .max_file_size(2 * 1024 * 1024)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            tts::generate_tts,
            tts::tts_capabilities,
            tts::tts_set_backend,
            diagnostics::log_directory,
            diagnostics::reveal_log_directory,
        ])
        .setup(|app| {
            wire_bundled_espeak(app);
            if let Ok(dir) = app.path().app_config_dir() {
                tts::backend::init(dir);
            }
            log::info!(
                "Kheru launched (version {}, platform {})",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS
            );
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Kheru");
}
