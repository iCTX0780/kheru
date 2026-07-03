#!/usr/bin/env python3
"""Download Piper voice models."""

import urllib.request
from pathlib import Path

VOICES_DIR = Path("voices")
VOICES_DIR.mkdir(exist_ok=True)

# Voice model URLs from official Piper release
VOICES = {
    "en_US-ryan-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.tar.gz",
    "en_US-amy-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.tar.gz",
}

def download_voice(name: str, url: str) -> None:
    """Download and extract a voice model."""
    onnx_file = VOICES_DIR / f"{name}.onnx"
    json_file = VOICES_DIR / f"{name}.onnx.json"

    # Skip if already downloaded
    if onnx_file.exists() and json_file.exists():
        print(f"✓ {name} already downloaded")
        return

    print(f"Downloading {name}...")
    try:
        import tarfile
        import tempfile

        tar_path = Path(tempfile.gettempdir()) / f"{name}.tar.gz"
        urllib.request.urlretrieve(url, tar_path)

        with tarfile.open(tar_path) as tar:
            tar.extractall(VOICES_DIR)

        tar_path.unlink()
        print(f"✓ {name} downloaded")
    except Exception as e:
        print(f"✗ Failed to download {name}: {e}")

if __name__ == "__main__":
    for voice_name, voice_url in VOICES.items():
        download_voice(voice_name, voice_url)
    print("\nDone! Voices are ready in voices/")
