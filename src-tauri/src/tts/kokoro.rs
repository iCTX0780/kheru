//! ONNX Runtime session that owns the Kokoro model. Loaded lazily and reused
//! across every `generate_tts` invocation. Dropped and rebuilt whenever the
//! user changes the execution-provider preference (see `backend::set_preference`
//! → `reset_session`).

use ort::session::Session;
use ort::value::Value;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use super::backend::{self, ActiveExecutionProvider};
use super::TtsError;

const MODEL_ID: &str = "onnx-community/Kokoro-82M-v1.0-ONNX";
/// Prefer the fp32 variant for correctness in phase 2; we can swap to
/// `model_q8f16.onnx` for smaller install size once the output is verified.
const MODEL_FILE: &str = "onnx/model.onnx";

struct LoadedSession {
    session: Session,
    ep: ActiveExecutionProvider,
}

/// `Session::run` requires `&mut self`, so we wrap it in a Mutex. Kokoro
/// inference is CPU-bound and single-threaded per call anyway — serializing
/// concurrent generate_tts requests is fine for now.
static SESSION: OnceLock<Mutex<Option<LoadedSession>>> = OnceLock::new();

/// Path to the bundled Kokoro model tree. In dev, resolved relative to the
/// Cargo manifest dir. Phase 5+ will switch to `AppHandle::path::resource_dir()`
/// so this works in a packaged .app / .msi / .AppImage too.
pub fn model_dir() -> PathBuf {
    let base = env!("CARGO_MANIFEST_DIR");
    PathBuf::from(base).join("resources/models").join(MODEL_ID)
}

fn slot() -> &'static Mutex<Option<LoadedSession>> {
    SESSION.get_or_init(|| Mutex::new(None))
}

/// Drop the cached session so the next `infer` call rebuilds with whichever
/// EP the current backend preference resolves to.
pub fn reset_session() {
    if let Ok(mut guard) = slot().lock() {
        *guard = None;
    }
}

/// The EP that the currently-loaded session was built with, or `None` if no
/// session has been built yet. Used by `backend::capabilities` to report the
/// *actual* backend to the UI instead of just what was requested.
pub fn active_ep() -> Option<ActiveExecutionProvider> {
    slot().lock().ok().and_then(|g| g.as_ref().map(|s| s.ep))
}

fn build_session(ep: ActiveExecutionProvider) -> Result<Session, TtsError> {
    let path = model_dir().join(MODEL_FILE);
    let builder = Session::builder()?;

    // Verbose partition logging: ORT prints which nodes each EP claimed vs.
    // dropped to CPU. Only visible in the terminal running `tauri:dev`.
    // Gated on KHERU_ORT_VERBOSE=1 so packaged builds stay quiet.
    let builder = if std::env::var("KHERU_ORT_VERBOSE").is_ok() {
        builder
            .with_log_level(ort::logging::LogLevel::Verbose)
            .map_err(|e| TtsError::Load(format!("set log level: {e}")))?
    } else {
        builder
    };

    let builder = match ep {
        ActiveExecutionProvider::Cpu => builder,
        ActiveExecutionProvider::CoreMl => attach_coreml(builder)?,
    };

    // `commit_from_file` takes `&mut self`.
    let mut builder = builder;
    builder
        .commit_from_file(&path)
        .map_err(|e| TtsError::Load(format!("load {}: {}", path.display(), e)))
}

#[cfg(target_os = "macos")]
fn attach_coreml(builder: ort::session::builder::SessionBuilder)
    -> Result<ort::session::builder::SessionBuilder, TtsError>
{
    use ort::ep::coreml::{ComputeUnits, ModelFormat, SpecializationStrategy};
    use ort::ep::CoreML;

    // MLProgram (CoreML 5+, macOS 12+) has broader op coverage than the
    // default NeuralNetwork format — the difference matters for Kokoro,
    // which is RNN/transformer-heavy. Without this, ORT's CoreML EP claims
    // only a small subgraph and the rest falls back to CPU, so ANE/GPU
    // utilization stays near zero (visible in macmon as CPU-dominant).
    //
    // FastPrediction trades specialization time (first inference) for
    // lower per-call latency after warm-up.
    //
    // `.error_on_failure()` flips the default of `fail_silently` — without
    // it, EP registration errors are swallowed and `commit_from_file`
    // returns Ok with CPU, masking whether CoreML was actually attached.
    let ep = CoreML::default()
        .with_model_format(ModelFormat::MLProgram)
        .with_compute_units(ComputeUnits::All)
        .with_specialization_strategy(SpecializationStrategy::FastPrediction)
        .with_static_input_shapes(false)
        .build()
        .error_on_failure();
    builder
        .with_execution_providers([ep])
        .map_err(|e| TtsError::Load(format!("attach CoreML EP: {e}")))
}

#[cfg(not(target_os = "macos"))]
fn attach_coreml(builder: ort::session::builder::SessionBuilder)
    -> Result<ort::session::builder::SessionBuilder, TtsError>
{
    // Not reachable — `effective_ep` never returns CoreMl off macOS. Kept as a
    // total function so kokoro.rs compiles across platforms.
    Ok(builder)
}

fn ensure_session() -> Result<&'static Mutex<Option<LoadedSession>>, TtsError> {
    let target = backend::effective_ep(backend::current_preference());
    let mutex = slot();
    {
        let guard = mutex.lock().map_err(|_| TtsError::Load("session mutex poisoned".into()))?;
        if let Some(existing) = guard.as_ref() {
            if existing.ep == target {
                return Ok(mutex);
            }
        }
    }
    // Either no session yet, or EP changed since last load — (re)build.
    let session = match build_session(target) {
        Ok(s) => {
            eprintln!("[tts] session built with EP={}", target.label());
            LoadedSession { session: s, ep: target }
        }
        Err(err) if matches!(target, ActiveExecutionProvider::CoreMl) => {
            // GPU EP failed to attach at commit time; degrade gracefully to
            // CPU so the app still generates.
            eprintln!("[tts] CoreML session build failed ({err}); falling back to CPU");
            let s = build_session(ActiveExecutionProvider::Cpu)?;
            LoadedSession { session: s, ep: ActiveExecutionProvider::Cpu }
        }
        Err(err) => return Err(err),
    };
    let mut guard = mutex.lock().map_err(|_| TtsError::Load("session mutex poisoned".into()))?;
    *guard = Some(session);
    Ok(mutex)
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
    let mut guard = session_mutex
        .lock()
        .map_err(|_| TtsError::Load("session mutex poisoned".into()))?;
    let loaded = guard
        .as_mut()
        .ok_or_else(|| TtsError::Load("session slot empty after ensure".into()))?;
    let seq_len = input_ids.len();

    // Use the tuple-shape form of Value::from_array so we don't drag ndarray
    // into our own tree (ort already depends on it; adding a top-level
    // ndarray produces a version-mismatch tangle).
    let ids_value = Value::from_array(([1_usize, seq_len], input_ids.to_vec()))?;
    let style_value = Value::from_array(([1_usize, 256_usize], style.to_vec()))?;
    let speed_value = Value::from_array(([1_usize], vec![speed]))?;

    let outputs = loaded.session.run(ort::inputs! {
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
