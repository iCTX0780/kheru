//! Kokoro TTS pipeline. Native replacement for the browser-side kokoro-js
//! worker so the app runs inside Tauri's webview on macOS (WKWebView cannot
//! execute the transformers.js/ONNX-Runtime-Web stack).
//!
//! Phase 1 (this commit): stub — returns silence at Kokoro's 24kHz output rate
//! so the invoke → Rust → audio-playback pipeline can be verified end-to-end
//! before any of the real model plumbing lands.

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod wav;

const KOKORO_SAMPLE_RATE: u32 = 24_000;

#[derive(Debug, Error)]
pub enum TtsError {
    #[error("WAV encode failed: {0}")]
    Wav(#[from] hound::Error),
    #[error("unknown voice: {0}")]
    UnknownVoice(String),
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
    #[allow(dead_code)] // consumed starting in phase 2 (real ONNX inference)
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

    // Phase 1 stub: 1 second of silence at 24kHz mono. Proves the pipeline.
    // Phase 2 will swap this for a real ort session over the Kokoro ONNX model.
    let sample_count = (KOKORO_SAMPLE_RATE * (1.0 / args.speed.max(0.5).min(2.0)) as u32).max(1);
    let samples = vec![0i16; sample_count as usize];

    let bytes = wav::encode_pcm16_mono(&samples, KOKORO_SAMPLE_RATE).map_err(TtsError::from)?;

    // Voice is validated only against a known allowlist for now — Phase 3 will
    // load the real voice embedding from bundled resources.
    if !is_known_voice(&args.voice) {
        return Err(TtsError::UnknownVoice(args.voice).into());
    }

    let gen_ms = start.elapsed().as_millis() as u32;
    Ok(GenerateResult {
        bytes,
        duration_seconds: sample_count as f32 / KOKORO_SAMPLE_RATE as f32,
        gen_ms,
    })
}

fn is_known_voice(voice: &str) -> bool {
    // Mirrors the VOICES table in kokoro-js. Kept as a flat list here because
    // the phase-1 stub doesn't care about attributes; phase 3 will replace this
    // with the real voice registry driven by the bundled .bin files.
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
