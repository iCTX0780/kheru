//! End-to-end smoke test that exercises the Rust Kokoro pipeline outside of
//! Tauri. Runs one full generation ("hello world" → real espeak-ng phonemes
//! → tokenize → ort → WAV) and dumps to `/tmp/kheru-kokoro-smoke.wav`.
//!
//! Run with: `cargo test --manifest-path src-tauri/Cargo.toml --test kokoro_smoke -- --nocapture`

use kheru_lib::tts::{kokoro, phonemize, tokenize, voice, wav};
use std::fs;

const SAMPLE_RATE: u32 = 24_000;

#[test]
fn hello_world_af_heart_produces_audible_wav() {
    let text = "Hello world!";
    let voice_name = "af_heart";

    eprintln!("→ phonemizing {text:?} for voice {voice_name}...");
    let phonemes = phonemize::phonemize(text, voice_name).expect("phonemize");
    eprintln!("  phonemes: {phonemes:?}");

    eprintln!("→ encoding phonemes...");
    let ids = tokenize::encode_phonemes(&phonemes).expect("tokenize");
    eprintln!("  input_ids ({} tokens): {:?}", ids.len(), ids);

    eprintln!("→ loading voice style ({voice_name}, seq_len={})...", ids.len());
    let style = voice::style_for(voice_name, ids.len()).expect("voice style");

    eprintln!("→ running Kokoro inference...");
    let samples = kokoro::infer(&ids, &style, 1.0).expect("inference");
    eprintln!(
        "  waveform: {} samples ({:.2}s @ {SAMPLE_RATE}Hz)",
        samples.len(),
        samples.len() as f32 / SAMPLE_RATE as f32
    );

    let non_zero = samples.iter().filter(|s| s.abs() > 1e-4).count();
    let peak = samples.iter().fold(0f32, |a, &b| a.max(b.abs()));
    eprintln!("  non-zero samples: {non_zero}, peak abs: {peak:.4}");

    let pcm = wav::f32_to_pcm16(&samples);
    let bytes = wav::encode_pcm16_mono(&pcm, SAMPLE_RATE).expect("wav encode");
    let path = "/tmp/kheru-kokoro-smoke.wav";
    fs::write(path, &bytes).expect("write wav");
    eprintln!("  wrote {} bytes to {path}", bytes.len());

    assert!(samples.len() > 1000, "sample count too small");
    assert!(non_zero > 100, "audio is silent");
    assert!(peak > 0.01, "audio peak too low");
}
