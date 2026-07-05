#!/usr/bin/env python3
"""Generate kokoro-onnx baseline for spike comparison."""
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "apps" / "api"))

import tts  # noqa: E402

TEXT = "Thanks for making the time. I wanted to walk through some important ideas with you."
OUT = ROOT / "voice-bakeoff" / "kokoro-onnx-am_michael-spike.wav"

tts._synth_line(TEXT, "kokoro:am_michael", OUT, length_scale=1.0)

with wave.open(str(OUT), "rb") as w:
    duration = w.getnframes() / w.getframerate()
    print(f"onnx baseline: {OUT}")
    print(f"  rate={w.getframerate()}Hz channels={w.getnchannels()} duration={duration:.2f}s")
