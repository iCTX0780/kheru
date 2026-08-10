//! Character-level phoneme tokenizer that mirrors Kokoro's `tokenizer.json`:
//!
//! - Normalizer strips any character not in the phoneme whitelist.
//! - Pre-tokenizer splits into individual characters.
//! - Post-processor wraps the sequence with `$` (id = 0) as start/end.
//!
//! We parse just the `model.vocab` map from `tokenizer.json` at first use.
//! The `tokenizers` crate can't deserialize this file (it uses a
//! `TemplateProcessing` post-processor variant the current crate version
//! rejects), and reimplementing the pipeline in ~30 lines is easier than
//! pinning around it.

use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::sync::OnceLock;

use super::{kokoro, TtsError};

static VOCAB: OnceLock<HashMap<char, i64>> = OnceLock::new();

#[derive(Deserialize)]
struct TokenizerFile {
    model: TokenizerModel,
}

#[derive(Deserialize)]
struct TokenizerModel {
    vocab: HashMap<String, i64>,
}

fn ensure_vocab() -> Result<&'static HashMap<char, i64>, TtsError> {
    if let Some(v) = VOCAB.get() {
        return Ok(v);
    }
    let path = kokoro::model_dir().join("tokenizer.json");
    let bytes = fs::read(&path)
        .map_err(|e| TtsError::Load(format!("read {}: {}", path.display(), e)))?;
    let file: TokenizerFile = serde_json::from_slice(&bytes)
        .map_err(|e| TtsError::Load(format!("parse {}: {}", path.display(), e)))?;
    let vocab: HashMap<char, i64> = file
        .model
        .vocab
        .into_iter()
        .filter_map(|(k, v)| {
            let mut cs = k.chars();
            match (cs.next(), cs.next()) {
                (Some(c), None) => Some((c, v)),
                _ => None, // multi-char keys aren't valid for a char-level tokenizer
            }
        })
        .collect();
    let _ = VOCAB.set(vocab);
    Ok(VOCAB.get().expect("vocab set"))
}

/// Encode a phoneme string into `[0, ...ids..., 0]`. Characters not in the
/// vocab are silently dropped, matching Kokoro's `Replace` normalizer.
pub fn encode_phonemes(phonemes: &str) -> Result<Vec<i64>, TtsError> {
    let vocab = ensure_vocab()?;
    let mut ids = Vec::with_capacity(phonemes.chars().count() + 2);
    ids.push(0);
    for c in phonemes.chars() {
        if let Some(&id) = vocab.get(&c) {
            ids.push(id);
        }
    }
    ids.push(0);
    Ok(ids)
}
