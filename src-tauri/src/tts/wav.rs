//! Minimal WAV encoding via the `hound` crate. Kept as its own module so the
//! ONNX inference path (phase 2) drops in cleanly next to it.

use hound::{SampleFormat, WavSpec, WavWriter};
use std::io::Cursor;

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
