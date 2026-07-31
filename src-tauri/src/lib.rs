pub mod tts;

use tauri::Manager;

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![tts::generate_tts])
        .setup(|app| {
            wire_bundled_espeak(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Kheru");
}
