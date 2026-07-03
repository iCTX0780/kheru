#!/usr/bin/env python3
"""Download Piper voice models.

Manual download:
Visit https://github.com/rhasspy/piper/releases and download .tar.gz voice files,
then extract to voices/ directory.

Example:
  curl -sSL https://github.com/rhasspy/piper/releases/download/2024.1.1/voice-en_US-ryan-medium.tar.gz | tar xz -C voices/
"""

import subprocess
import urllib.request
from pathlib import Path

VOICES_DIR = Path("voices")
VOICES_DIR.mkdir(exist_ok=True)

# Voice model URLs - these are from official Piper GitHub releases
VOICES = {
    "en_US-ryan-medium": "https://github.com/rhasspy/piper/releases/download/2024.1.1/voice-en_US-ryan-medium.tar.gz",
    "en_US-amy-medium": "https://github.com/rhasspy/piper/releases/download/2024.1.1/voice-en_US-amy-medium.tar.gz",
}

def download_voice(name: str, url: str) -> None:
    """Download and extract a voice model."""
    onnx_file = VOICES_DIR / f"{name}.onnx"
    json_file = VOICES_DIR / f"{name}.onnx.json"

    if onnx_file.exists() and json_file.exists():
        print(f"✓ {name} already exists")
        return

    print(f"Downloading {name}...")
    try:
        cmd = f"curl -sSL '{url}' | tar xz -C {VOICES_DIR}"
        subprocess.run(cmd, shell=True, check=True)
        print(f"✓ {name} downloaded")
    except Exception as e:
        print(f"✗ Failed to download {name}: {e}")
        print(f"  Try manual download: {url}")

if __name__ == "__main__":
    for voice_name, voice_url in VOICES.items():
        download_voice(voice_name, voice_url)

    # Verify
    downloaded = list(VOICES_DIR.glob("*.onnx"))
    if downloaded:
        print(f"\n✓ Found {len(downloaded)} voice model(s)")
    else:
        print("\n✗ No voices found. Download voices manually from:")
        print("  https://github.com/rhasspy/piper/releases")
        print("  Extract .tar.gz files to voices/ directory")
