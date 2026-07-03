#!/usr/bin/env python3
"""Generate voice samples for comparison."""

import subprocess
from pathlib import Path

VOICES_DIR = Path("voices")
SAMPLE_TEXT = "Thanks for making the time. I wanted to walk through some important ideas with you."

# Male voices to test (ordered by potential warmth/depth)
MALE_VOICES = [
    "en_US-joe-medium",      # 1. Joe
    "en_US-sam-medium",      # 2. Sam
    "en_US-ryan-high",       # 3. Ryan High
    "en_US-ryan-medium",     # 4. Ryan Medium
    "en_US-bryce-medium",    # 5. Bryce (download in progress)
]

def generate_sample(voice: str, text: str, output: Path, length_scale: float = 1.2) -> None:
    """Generate a sample WAV for a voice."""
    model = VOICES_DIR / f"{voice}.onnx"
    if not model.exists():
        print(f"✗ {voice} not found")
        return

    cmd = [
        "piper",
        "--model", str(model),
        "--output_file", str(output),
        "--length_scale", str(length_scale)
    ]
    proc = subprocess.run(cmd, input=text, text=True, capture_output=True)
    if proc.returncode == 0:
        print(f"✓ {voice}")
    else:
        print(f"✗ {voice}: {proc.stderr}")

if __name__ == "__main__":
    print("Generating male voice samples...\n")

    for i, voice in enumerate(MALE_VOICES, 1):
        output = Path(f"sample_{i}_{voice.split('-')[1]}.wav")
        generate_sample(voice, SAMPLE_TEXT, output)

    print("\nSamples created:")
    for f in sorted(Path(".").glob("sample_*.wav")):
        print(f"  {f}")
