#!/usr/bin/env python3
"""Generate static preview WAV files for curated Kokoro voices."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "legacy" / "fastapi"))

import tts  # noqa: E402
from voice_catalog import CURATED_VOICES  # noqa: E402

PREVIEW_TEXT = "Hello, this is a preview of my voice."
OUTPUT_DIR = ROOT / "apps" / "kheru" / "public" / "voice-samples"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for voice in CURATED_VOICES:
        out_path = OUTPUT_DIR / voice.preview_filename
        print(f"Generating {out_path.name}...")
        tts._synth_line(
            PREVIEW_TEXT,
            voice.id,
            out_path,
            length_scale=voice.default_length_scale,
        )

    print(f"Done — {len(CURATED_VOICES)} samples in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
