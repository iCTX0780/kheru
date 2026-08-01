//! TTS execution backend: which ONNX Runtime execution provider Kokoro should
//! use, plus the user preference persisted across launches.
//!
//! - `Auto` = try GPU (CoreML on macOS today), fall back to CPU
//! - `Gpu`  = try GPU only; if unavailable, still fall back to CPU but the
//!            frontend surfaces a warning based on `TtsCapabilities.gpu_available`
//! - `Cpu`  = never attach a GPU EP
//!
//! The preference lives in `app_config_dir()/tts-backend.json` — a tiny JSON
//! file we own, not part of the frontend's IndexedDB. Kept separate so wiping
//! browser storage doesn't reset compute settings.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

/// User-facing choice. Stored as lowercase string.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TtsBackend {
    Auto,
    Gpu,
    Cpu,
}

impl Default for TtsBackend {
    fn default() -> Self {
        Self::Auto
    }
}

/// What actually gets appended to the ort SessionBuilder for this platform.
/// "cpu" means no accelerator EP registered (ort falls back to its CPU EP).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ActiveExecutionProvider {
    Cpu,
    CoreMl,
}

impl ActiveExecutionProvider {
    pub fn label(self) -> &'static str {
        match self {
            Self::Cpu => "cpu",
            Self::CoreMl => "coreml",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TtsCapabilities {
    /// Whether a GPU/accelerator EP is compiled in AND available on this device.
    pub gpu_available: bool,
    /// e.g. "CoreML (Apple Neural Engine + GPU)" — for the settings UI.
    pub gpu_label: Option<String>,
    /// The user's persisted preference.
    pub preference: TtsBackend,
    /// What we will actually attach on the next session build.
    pub effective: ActiveExecutionProvider,
    /// Human-readable name of the platform target so the UI can explain
    /// why GPU may not be offered.
    pub platform: &'static str,
}

/// Runtime feasibility of a GPU accelerator on this build.
///
/// On macOS the `ort` `coreml` feature is compiled in, so CoreML is always
/// callable. On Windows/Linux we ship CPU-only for now — DirectML / CUDA
/// tracking is issue #14.
pub fn gpu_available() -> bool {
    cfg!(target_os = "macos")
}

pub fn gpu_label() -> Option<String> {
    if cfg!(target_os = "macos") {
        Some("CoreML (Apple Neural Engine + GPU)".to_string())
    } else {
        None
    }
}

pub fn platform_label() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "other"
    }
}

pub fn effective_ep(pref: TtsBackend) -> ActiveExecutionProvider {
    match pref {
        TtsBackend::Cpu => ActiveExecutionProvider::Cpu,
        TtsBackend::Auto | TtsBackend::Gpu => {
            if gpu_available() && cfg!(target_os = "macos") {
                ActiveExecutionProvider::CoreMl
            } else {
                ActiveExecutionProvider::Cpu
            }
        }
    }
}

// ---- Preference storage ----

static PREF: OnceLock<Mutex<TtsBackend>> = OnceLock::new();
static CONFIG_PATH: OnceLock<PathBuf> = OnceLock::new();

#[derive(Serialize, Deserialize)]
struct PreferenceFile {
    backend: TtsBackend,
}

/// Called once at startup from `lib.rs::setup`. Reads the persisted pref if
/// present; missing/corrupt file → default (Auto).
pub fn init(config_dir: PathBuf) {
    let path = config_dir.join("tts-backend.json");
    let loaded = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<PreferenceFile>(&s).ok())
        .map(|p| p.backend)
        .unwrap_or_default();
    let _ = CONFIG_PATH.set(path);
    let _ = PREF.set(Mutex::new(loaded));
}

pub fn current_preference() -> TtsBackend {
    PREF.get()
        .and_then(|m| m.lock().ok().map(|g| *g))
        .unwrap_or_default()
}

pub fn set_preference(next: TtsBackend) -> Result<(), String> {
    let Some(mutex) = PREF.get() else {
        return Err("backend preference not initialized".into());
    };
    let mut guard = mutex.lock().map_err(|_| "pref mutex poisoned".to_string())?;
    if *guard == next {
        return Ok(());
    }
    *guard = next;

    if let Some(path) = CONFIG_PATH.get() {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let payload = PreferenceFile { backend: next };
        if let Ok(json) = serde_json::to_string_pretty(&payload) {
            let _ = std::fs::write(path, json);
        }
    }
    Ok(())
}

pub fn capabilities() -> TtsCapabilities {
    let pref = current_preference();
    TtsCapabilities {
        gpu_available: gpu_available(),
        gpu_label: gpu_label(),
        preference: pref,
        effective: effective_ep(pref),
        platform: platform_label(),
    }
}
