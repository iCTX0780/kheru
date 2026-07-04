#!/usr/bin/env python3
"""Generate static preview WAV files for each installed Piper voice."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "apps" / "api"))

import tts  # noqa: E402

PREVIEW_TEXT = "Hello, this is a preview of my voice."
OUTPUT_DIR = ROOT / "apps" / "web" / "public" / "voice-samples"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    voices = tts.list_voices()
    if not voices:
        print("No voices found. Run download_voices.py first.")
        sys.exit(1)

    for voice in voices:
        out_path = OUTPUT_DIR / f"{voice}.wav"
        print(f"Generating {out_path.name}...")
        tts._synth_line(PREVIEW_TEXT, voice, out_path, length_scale=1.0)

    print(f"Done — {len(voices)} samples in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
