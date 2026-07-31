//! Voice bank loader. Each Kokoro voice ships as a `Float32Array` of
//! 512 × 256 = 131 072 floats in a `.bin` file. The style slice fed to the
//! model is 256 floats, indexed by input length:
//!
//! ```text
//! offset_bytes = 256 * min(seq_len - 2, 509) * 4
//! ```
//!
//! (Mirrors kokoro-js's `getVoiceData(name).slice(offset, offset + 256)`.)

use std::collections::HashMap;
use std::fs;
use std::sync::{OnceLock, RwLock};

use super::{kokoro, TtsError};

static CACHE: OnceLock<RwLock<HashMap<String, Vec<f32>>>> = OnceLock::new();

fn cache() -> &'static RwLock<HashMap<String, Vec<f32>>> {
    CACHE.get_or_init(|| RwLock::new(HashMap::new()))
}

fn load_voice(name: &str) -> Result<Vec<f32>, TtsError> {
    if let Some(v) = cache().read().ok().and_then(|c| c.get(name).cloned()) {
        return Ok(v);
    }
    let path = kokoro::model_dir().join(format!("voices/{name}.bin"));
    let bytes = fs::read(&path)
        .map_err(|e| TtsError::Load(format!("read voice {}: {}", path.display(), e)))?;
    if bytes.len() % 4 != 0 {
        return Err(TtsError::Load(format!(
            "voice {name} has {} bytes, not a multiple of 4",
            bytes.len()
        )));
    }
    let floats: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();
    if let Ok(mut c) = cache().write() {
        c.insert(name.to_string(), floats.clone());
    }
    Ok(floats)
}

/// Return the 256-dim style slice for a given voice + input length.
pub fn style_for(name: &str, seq_len: usize) -> Result<Vec<f32>, TtsError> {
    let voice = load_voice(name)?;
    // Mirror kokoro-js: 256 * clamp(seq_len - 2, 0, 509) floats offset.
    let slot = seq_len.saturating_sub(2).min(509);
    let start = 256 * slot;
    let end = start + 256;
    if end > voice.len() {
        return Err(TtsError::Load(format!(
            "voice {name} too small for slot {slot} (have {} floats, need {end})",
            voice.len()
        )));
    }
    Ok(voice[start..end].to_vec())
}
