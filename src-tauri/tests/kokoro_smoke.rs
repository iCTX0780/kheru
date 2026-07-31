//! End-to-end smoke test that exercises the Rust Kokoro pipeline outside of
//! Tauri. Runs one inference on a hardcoded phoneme string ("hello") and
//! dumps `/tmp/kheru-kokoro-smoke.wav`. Real text→phonemes lands in phase 3.
//!
//! Run with: `cargo test --manifest-path src-tauri/Cargo.toml --test kokoro_smoke -- --nocapture`

use kheru_lib::tts::{kokoro, tokenize, voice, wav};
use std::fs;

const SAMPLE_RATE: u32 = 24_000;

#[test]
fn hello_af_heart_produces_audible_wav() {
    let phonemes = "hˈɛloʊ";
    let voice_name = "af_heart";

    eprintln!("→ encoding phonemes...");
    let ids = tokenize::encode_phonemes(phonemes).expect("tokenize");
    eprintln!("  input_ids ({} tokens): {:?}", ids.len(), ids);

    eprintln!("→ loading voice style ({voice_name}, seq_len={})...", ids.len());
    let style = voice::style_for(voice_name, ids.len()).expect("voice style");
    eprintln!("  style dim: {} (should be 256)", style.len());

    eprintln!("→ running Kokoro inference (first call loads the model — may take a few seconds)...");
    let samples = kokoro::infer(&ids, &style, 1.0).expect("inference");
    eprintln!("  waveform samples: {}", samples.len());
    eprintln!(
        "  audio duration: {:.2}s @ {SAMPLE_RATE}Hz",
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
    assert!(non_zero > 100, "audio is silent — got {non_zero} non-zero samples");
    assert!(peak > 0.01, "audio peak too low — got {peak}");
}
