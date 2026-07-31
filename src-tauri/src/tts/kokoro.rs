//! ONNX Runtime session that owns the Kokoro model. Loaded once, reused
//! across every `generate_tts` invocation.

use ort::session::Session;
use ort::value::Value;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use super::TtsError;

const MODEL_ID: &str = "onnx-community/Kokoro-82M-v1.0-ONNX";
/// Prefer the fp32 variant for correctness in phase 2; we can swap to
/// `model_q8f16.onnx` for smaller install size once the output is verified.
const MODEL_FILE: &str = "onnx/model.onnx";

/// `Session::run` requires `&mut self`, so we wrap it in a Mutex. Kokoro
/// inference is CPU-bound and single-threaded per call anyway — serializing
/// concurrent generate_tts requests is fine for now.
static SESSION: OnceLock<Mutex<Session>> = OnceLock::new();

/// Path to the bundled Kokoro model tree. In dev, resolved relative to the
/// Cargo manifest dir. Phase 5+ will switch to `AppHandle::path::resource_dir()`
/// so this works in a packaged .app / .msi / .AppImage too.
pub fn model_dir() -> PathBuf {
    let base = env!("CARGO_MANIFEST_DIR");
    PathBuf::from(base).join("resources/models").join(MODEL_ID)
}

fn ensure_session() -> Result<&'static Mutex<Session>, TtsError> {
    if let Some(s) = SESSION.get() {
        return Ok(s);
    }
    let path = model_dir().join(MODEL_FILE);
    let session = Session::builder()?
        .commit_from_file(&path)
        .map_err(|e| TtsError::Load(format!("load {}: {}", path.display(), e)))?;
    let _ = SESSION.set(Mutex::new(session));
    Ok(SESSION.get().expect("session set"))
}

/// Run one forward pass. `input_ids` should already include the leading and
/// trailing 0 tokens that Kokoro expects. `style` is the 256-dim voice
/// embedding slice. `speed` is a scalar in [0.5, 2.0].
pub fn infer(input_ids: &[i64], style: &[f32], speed: f32) -> Result<Vec<f32>, TtsError> {
    if style.len() != 256 {
        return Err(TtsError::Load(format!(
            "style embedding must be 256 dims, got {}",
            style.len()
        )));
    }
    let session_mutex = ensure_session()?;
    let mut session = session_mutex
        .lock()
        .map_err(|_| TtsError::Load("session mutex poisoned".into()))?;
    let seq_len = input_ids.len();

    // Use the tuple-shape form of Value::from_array so we don't drag ndarray
    // into our own tree (ort already depends on it; adding a top-level
    // ndarray produces a version-mismatch tangle).
    let ids_value = Value::from_array(([1_usize, seq_len], input_ids.to_vec()))?;
    let style_value = Value::from_array(([1_usize, 256_usize], style.to_vec()))?;
    let speed_value = Value::from_array(([1_usize], vec![speed]))?;

    let outputs = session.run(ort::inputs! {
        "input_ids" => ids_value,
        "style" => style_value,
        "speed" => speed_value,
    })?;

    // Kokoro's ONNX export names the output "waveform".
    let waveform_ref = outputs
        .get("waveform")
        .ok_or_else(|| TtsError::Load("model has no 'waveform' output".into()))?;

    let (_shape, data) = waveform_ref.try_extract_tensor::<f32>()?;
    Ok(data.to_vec())
}

#[allow(dead_code)]
pub fn model_path_hint() -> impl AsRef<Path> {
    model_dir().join(MODEL_FILE)
}
