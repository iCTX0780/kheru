//! Minimal WAV encoding via the `hound` crate. Kept as its own module so the
//! ONNX inference path (phase 2) drops in cleanly next to it.

use hound::{SampleFormat, WavSpec, WavWriter};
use std::io::Cursor;

/// Convert model output (Float32 nominally in [-1.0, 1.0]) to PCM16 samples.
pub fn f32_to_pcm16(samples: &[f32]) -> Vec<i16> {
    samples
        .iter()
        .map(|&s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
        .collect()
}

pub fn encode_pcm16_mono(samples: &[i16], sample_rate: u32) -> Result<Vec<u8>, hound::Error> {
    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    let mut buf = Cursor::new(Vec::<u8>::with_capacity(44 + samples.len() * 2));
    {
        let mut writer = WavWriter::new(&mut buf, spec)?;
        for &s in samples {
            writer.write_sample(s)?;
        }
        writer.finalize()?;
    }
    Ok(buf.into_inner())
}
