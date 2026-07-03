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

def download_voices_batch() -> None:
    """Download all voices using Piper's built-in downloader."""
    print("Downloading Piper voice models from HuggingFace...")
    print("(https://huggingface.co/rhasspy/piper-voices)\n")

    try:
        # Use piper's built-in download utility with correct arguments
        cmd = ["python", "-m", "piper.download_voices", "--download-dir", str(VOICES_DIR)] + VOICES
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(result.stdout)
        if result.returncode == 0:
            print(f"✓ Downloads complete")
    except subprocess.CalledProcessError as e:
        print(f"✗ Download failed")
        if e.stderr:
            print(f"  Error: {e.stderr}")
    except FileNotFoundError:
        print("✗ piper command not found. Make sure piper-tts is installed:")
        print("  pip install piper-tts")

if __name__ == "__main__":
    download_voices_batch()


    # Verify
    imported = list(VOICES_DIR.glob("**/*.onnx"))
    if imported:
        print(f"\n✓ Ready! Found {len(imported)} voice model(s):")
        for f in sorted(imported):
            print(f"  - {f.name}")
    else:
        print("\n✗ No voices found after download.")
        print("\nManual download options:")
        print("  1. Visit: https://huggingface.co/rhasspy/piper-voices")
        print("  2. Download .onnx + .onnx.json pairs for voices you want")
        print("  3. Extract to voices/ directory (flat structure)")
