#!/usr/bin/env python3
"""Download Piper voice models from HuggingFace.

Voice models are hosted at: https://huggingface.co/rhasspy/piper-voices
"""

import subprocess
from pathlib import Path

VOICES_DIR = Path("voices")
VOICES_DIR.mkdir(exist_ok=True)

# Voice names to download from HuggingFace
VOICES = [
    "en_US-lessac-medium",
    "en_US-libritts_r-medium",
]

# HuggingFace base URL for voice models
HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"

def download_voice(name: str) -> None:
    """Download voice model using Piper's built-in downloader."""
    onnx_file = VOICES_DIR / f"{name}.onnx"
    json_file = VOICES_DIR / f"{name}.onnx.json"

    if onnx_file.exists() and json_file.exists():
        print(f"✓ {name} already exists")
        return

    print(f"Downloading {name}...")
    try:
        # Use piper's built-in download utility
        cmd = ["python", "-m", "piper.download_voices", "--output-dir", str(VOICES_DIR), "--voice", name]
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"✓ {name} downloaded")
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to download {name}")
        print(f"  Error: {e.stderr}")
        print(f"\n  Manual download: visit https://huggingface.co/rhasspy/piper-voices")
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    print("Downloading Piper voice models from HuggingFace...")
    print("(https://huggingface.co/rhasspy/piper-voices)\n")

    for voice_name in VOICES:
        download_voice(voice_name)

    # Verify
    downloaded = list(VOICES_DIR.glob("*.onnx"))
    if downloaded:
        print(f"\n✓ Ready! Found {len(downloaded)} voice model(s)")
        for f in sorted(downloaded):
            print(f"  - {f.name}")
    else:
        print("\n✗ No voices found.")
        print("\nManual download options:")
        print("  1. Use piper directly: python -m piper.download_voices")
        print("  2. Visit: https://huggingface.co/rhasspy/piper-voices")
        print("  3. Extract .onnx and .onnx.json files to voices/ directory")
