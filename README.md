# TTS Conversation Generator

A lightweight, fully local pipeline that turns a multi-speaker conversation script into a single audio file using Piper TTS.

## Setup

### 1. Install Piper

```bash
pip install piper-tts
```

### 2. Create voices directory

```bash
mkdir voices
```

### 3. Download voice models

Download `.onnx` and `.onnx.json` file pairs from the [Piper voice catalogue](https://github.com/rhasspy/piper/blob/master/VOICES.md).

Suggested voices:
- **Male**: `en_US-ryan-medium`
- **Female**: `en_US-amy-medium` or `en_US-kristin-medium`

Place them in the `voices/` directory:

```
voices/
├── en_US-ryan-medium.onnx
├── en_US-ryan-medium.onnx.json
├── en_US-amy-medium.onnx
└── en_US-amy-medium.onnx.json
```

## Usage

### 1. Edit `conversation.json`

Define your multi-speaker dialogue:

```json
{
  "conversation": [
    {
      "speaker": "adam",
      "voice": "en_US-ryan-medium",
      "text": "Hey, thanks for making the time."
    },
    {
      "speaker": "alice",
      "voice": "en_US-amy-medium",
      "text": "Of course. Let's dive in."
    }
  ]
}
```

### 2. Generate audio

```bash
python tts_generator.py
```

Output: `rehearsal.wav`

## Tuning

Edit `tts_generator.py` to adjust:
- `GAP_SECONDS` — pause between speaker turns (default: 0.4)
- Add `--length-scale` to `synth_line()` for speed control (e.g., `1.1` = slower)

## Tips

- Use `medium` or `high` quality models for natural sound
- Punctuation shapes prosody — write the way it should be *spoken*
- Audition voices at [Piper samples](https://rhasspy.github.io/piper-samples/)
