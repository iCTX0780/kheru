//! Kokoro TTS pipeline. Native replacement for the browser-side kokoro-js
//! worker so the app runs inside Tauri's webview on macOS (WKWebView cannot
//! execute the transformers.js/ONNX-Runtime-Web stack).
//!
//! Phase 2 (this commit): real ONNX inference via `ort`, real voice bank
//! loading, char-level HF-compatible tokenizer — but **hardcoded phoneme
//! string** so the generated audio is a fixed word (currently "hello")
//! regardless of the input text. Phase 3 replaces the hardcoded phonemes
//! with espeak-ng output; phase 4 adds text normalization on top.

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod kokoro;
pub mod tokenize;
pub mod voice;
pub mod wav;

const KOKORO_SAMPLE_RATE: u32 = 24_000;

/// Placeholder — real phonemes will come from espeak-ng in phase 3.
/// This is "hello" in IPA (approximately what `phonemize("hello", "en-us")`
/// returns) with Kokoro's post-processing already applied.
const PHASE2_PHONEMES: &str = "hˈɛloʊ";

#[derive(Debug, Error)]
pub enum TtsError {
    #[error("WAV encode failed: {0}")]
    Wav(#[from] hound::Error),
    #[error("unknown voice: {0}")]
    UnknownVoice(String),
    #[error("model load failed: {0}")]
    Load(String),
    #[error("ORT: {0}")]
    Ort(#[from] ort::Error),
}

/// Serde-safe error wrapper for the IPC boundary.
pub struct TtsErrorSerde(pub String);

impl serde::Serialize for TtsErrorSerde {
    fn serialize<S: serde::ser::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.0)
    }
}

impl From<TtsError> for TtsErrorSerde {
    fn from(e: TtsError) -> Self {
        Self(e.to_string())
    }
}

#[derive(Debug, Deserialize)]
pub struct GenerateArgs {
    #[allow(dead_code)] // consumed starting in phase 3 (real phonemization)
    pub text: String,
    pub voice: String,
    pub speed: f32,
}

#[derive(Debug, Serialize)]
pub struct GenerateResult {
    /// WAV file bytes, ready for the frontend to wrap in a Blob.
    pub bytes: Vec<u8>,
    /// Audio duration in seconds. Used by the frontend to size the timeline.
    pub duration_seconds: f32,
    /// Milliseconds spent generating (for the UI's perf display).
    pub gen_ms: u32,
}

#[tauri::command]
pub async fn generate_tts(args: GenerateArgs) -> Result<GenerateResult, TtsErrorSerde> {
    let start = std::time::Instant::now();

    if !is_known_voice(&args.voice) {
        return Err(TtsError::UnknownVoice(args.voice).into());
    }
    let clamped_speed = args.speed.clamp(0.5, 2.0);

    // Tokenize the hardcoded phoneme string, load the voice's style slice,
    // run inference, encode WAV.
    let input_ids = tokenize::encode_phonemes(PHASE2_PHONEMES).map_err(TtsErrorSerde::from)?;
    let style = voice::style_for(&args.voice, input_ids.len()).map_err(TtsErrorSerde::from)?;
    let samples = kokoro::infer(&input_ids, &style, clamped_speed).map_err(TtsErrorSerde::from)?;

    let pcm = wav::f32_to_pcm16(&samples);
    let bytes = wav::encode_pcm16_mono(&pcm, KOKORO_SAMPLE_RATE)
        .map_err(TtsError::from)
        .map_err(TtsErrorSerde::from)?;

    let gen_ms = start.elapsed().as_millis() as u32;
    Ok(GenerateResult {
        bytes,
        duration_seconds: samples.len() as f32 / KOKORO_SAMPLE_RATE as f32,
        gen_ms,
    })
}

fn is_known_voice(voice: &str) -> bool {
    matches!(
        voice,
        "af_heart"
            | "af_alloy"
            | "af_aoede"
            | "af_bella"
            | "af_jessica"
            | "af_kore"
            | "af_nicole"
            | "af_nova"
            | "af_river"
            | "af_sarah"
            | "af_sky"
            | "am_adam"
            | "am_echo"
            | "am_eric"
            | "am_fenrir"
            | "am_liam"
            | "am_michael"
            | "am_onyx"
            | "am_puck"
            | "am_santa"
            | "bf_emma"
            | "bf_isabella"
            | "bm_george"
            | "bm_lewis"
            | "bf_alice"
            | "bf_lily"
            | "bm_daniel"
            | "bm_fable"
    )
}
