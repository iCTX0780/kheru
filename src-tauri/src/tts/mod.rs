//! Kokoro TTS pipeline. Native replacement for the browser-side kokoro-js
//! worker so the app runs inside Tauri's webview on macOS (WKWebView cannot
//! execute the transformers.js/ONNX-Runtime-Web stack).
//!
//! Phase 3 (this commit): real phonemization via espeak-ng — the app now
//! speaks the actual input text. Phase 4 will add kokoro-js's pre-espeak text
//! normalization (numbers, currency, dates, abbreviations, contractions).

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod kokoro;
pub mod phonemize;
pub mod tokenize;
pub mod voice;
pub mod wav;

const KOKORO_SAMPLE_RATE: u32 = 24_000;

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

    // Phonemize → tokenize → load voice style → infer → encode WAV.
    let phonemes = phonemize::phonemize(&args.text, &args.voice).map_err(TtsErrorSerde::from)?;
    let input_ids = tokenize::encode_phonemes(&phonemes).map_err(TtsErrorSerde::from)?;
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
