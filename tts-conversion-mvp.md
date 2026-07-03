# MVP: Local TTS Conversation Generator

A lightweight, fully local pipeline that turns a multi-speaker conversation
script into a single audio file — assigning a different voice per speaker,
the way Eleven Labs does. No cloud, no API keys, no token limits.

This is the "prove the concept fast" version: one Python script, a JSON input,
one WAV out.

---

## Why Piper

[Piper](https://github.com/rhasspy/piper) is a fast, offline neural TTS engine.
It runs comfortably on CPU, ships dozens of natural-sounding pretrained voices,
and needs only a small model file per voice (~20–60 MB). Good enough to sound
human for rehearsal purposes, and it never phones home.

---

## Prerequisites

- Python 3.9+
- `pip`
- ~200–500 MB disk for a couple of voice models

---

## Setup

### 1. Install Piper

```bash
pip install piper-tts
```

### 2. Download voice models

Piper voices are `.onnx` + `.onnx.json` file pairs. Grab two — one male,
one female — from the official voice list:

- Voice catalogue: https://github.com/rhasspy/piper/blob/master/VOICES.md
- Samples to audition: https://rhasspy.github.io/piper-samples/

Put the downloaded files in a `voices/` folder. For example:

```
voices/
├── en_US-ryan-medium.onnx
├── en_US-ryan-medium.onnx.json
├── en_US-amy-medium.onnx
└── en_US-amy-medium.onnx.json
```

> Rough Eleven Labs mapping: **Adam → `en_US-ryan-medium`**,
> **Alice → `en_US-amy-medium`** or `en_US-kristin-medium`. Audition a few and
> pick the ones you like.

---

## Conversation format

Create `conversation.json`. Each turn names the speaker, the voice model to
use, and the line of text.

```json
{
  "conversation": [
    {
      "speaker": "adam",
      "voice": "en_US-ryan-medium",
      "text": "Hey, thanks for making the time. I wanted to walk through the numbers with you."
    },
    {
      "speaker": "alice",
      "voice": "en_US-amy-medium",
      "text": "Of course. I've got about twenty minutes before my next call, so let's dive in."
    },
    {
      "speaker": "adam",
      "voice": "en_US-ryan-medium",
      "text": "Perfect. So here's where we landed last quarter..."
    }
  ]
}
```

---

## The script

Create `tts_generator.py`. This version stitches the clips together with
Python's built-in `wave` module, so the only external dependency is Piper
itself — no ffmpeg required for the MVP.

```python
import json
import subprocess
import wave
from pathlib import Path

VOICES_DIR = Path("voices")
TEMP_DIR = Path("temp")
GAP_SECONDS = 0.4  # pause inserted between speaker turns


def synth_line(text: str, voice: str, out_path: Path) -> None:
    """Generate a single WAV clip for one line using Piper."""
    model = VOICES_DIR / f"{voice}.onnx"
    cmd = ["piper", "--model", str(model), "--output_file", str(out_path)]
    proc = subprocess.run(cmd, input=text, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Piper failed for '{text[:40]}...': {proc.stderr}")


def concat_wavs(clips: list[Path], output_file: Path, gap: float = GAP_SECONDS) -> None:
    """Concatenate WAV clips into one file, inserting a short silent gap."""
    if not clips:
        raise ValueError("No clips to concatenate.")

    with wave.open(str(clips[0]), "rb") as first:
        params = first.getparams()
        framerate = first.getframerate()
        sampwidth = first.getsampwidth()
        channels = first.getnchannels()

    silence = b"\x00" * int(framerate * gap) * sampwidth * channels

    with wave.open(str(output_file), "wb") as out:
        out.setparams(params)
        for i, clip in enumerate(clips):
            with wave.open(str(clip), "rb") as w:
                out.writeframes(w.readframes(w.getnframes()))
            if i < len(clips) - 1:
                out.writeframes(silence)


def generate(conversation_file: str, output_file: str = "rehearsal.wav") -> None:
    TEMP_DIR.mkdir(exist_ok=True)

    with open(conversation_file) as f:
        data = json.load(f)

    clips = []
    for idx, turn in enumerate(data["conversation"]):
        clip_path = TEMP_DIR / f"turn_{idx:03d}.wav"
        print(f"[{turn['speaker']}] {turn['text'][:60]}...")
        synth_line(turn["text"], turn["voice"], clip_path)
        clips.append(clip_path)

    concat_wavs(clips, Path(output_file))
    print(f"\nDone → {output_file}")

    for clip in clips:
        clip.unlink()


if __name__ == "__main__":
    generate("conversation.json", "rehearsal.wav")
```

---

## Run it

```bash
python tts_generator.py
```

Output: `rehearsal.wav`. Drop it on your phone / push it to your earbuds and
rehearse.

---

## Tuning tips

- **Pacing** — adjust `GAP_SECONDS` for a longer/shorter beat between turns.
- **Speed** — Piper accepts `--length-scale` (e.g. `1.1` = slightly slower,
  more deliberate). Add it to the `cmd` list in `synth_line`.
- **Expressiveness** — the `*-medium` and `*-high` quality models sound more
  natural than `*-low`. Prefer `medium` for the speed/quality balance.
- **Punctuation matters** — commas, ellipses, and full stops shape the prosody.
  Writing the script the way it should be *spoken* gets you most of the way to
  "human."

---

## What this MVP intentionally skips

No UI, no persistence, no Docker. You edit a JSON file and run a script. If the
concept holds up in rehearsal, graduate to the full-stack service (see the
companion doc).