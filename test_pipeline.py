#!/usr/bin/env python3
"""Test the TTS pipeline without requiring actual Piper models."""

import json
import wave
import struct
from pathlib import Path
from tts_generator import concat_wavs

TEMP_DIR = Path("temp")

def create_test_wav(output_path: Path, duration: float = 0.5) -> None:
    """Create a minimal test WAV file."""
    sample_rate = 22050
    samples = []

    # Simple sine wave
    for i in range(int(sample_rate * duration)):
        val = int(32000 * 0.3 * (i / sample_rate * 440 * 2 * 3.14159) % (2 * 3.14159))
        samples.append(struct.pack('<h', min(32767, max(-32768, val))))

    with wave.open(str(output_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(b"".join(samples))

def test_concat():
    """Test concatenation without Piper."""
    print("Testing concat pipeline...")
    TEMP_DIR.mkdir(exist_ok=True)

    # Create test clips
    clips = []
    for i in range(3):
        clip_path = TEMP_DIR / f"test_clip_{i}.wav"
        create_test_wav(clip_path)
        clips.append(clip_path)

    # Concatenate
    output = Path("test_output.wav")
    concat_wavs(clips, output, gap=0.2)

    # Check result
    with wave.open(str(output), "rb") as w:
        frames = w.getnframes()
        print(f"✓ Output WAV created: {output}")
        print(f"  Frames: {frames}")
        print(f"  Duration: {frames / w.getframerate():.2f}s")

    # Cleanup
    for clip in clips:
        clip.unlink()
    TEMP_DIR.rmdir()

if __name__ == "__main__":
    test_concat()
