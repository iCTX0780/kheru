# TTS Conversation Generator

A lightweight, fully local pipeline that turns a multi-speaker conversation script into a single audio file using Piper TTS.

## Setup

### 1. Set up Python environment

```bash
python3 -m venv venv
source venv/bin/activate  # or: . venv/bin/activate on Windows
pip install -r requirements.txt
```

### 2. Download voice models

Voice models are hosted on [HuggingFace](https://huggingface.co/rhasspy/piper-voices).

**Quick option** — use the helper script:

```bash
source venv/bin/activate
python download_voices.py
```

**Manual option** — use Piper's built-in downloader:

```bash
source venv/bin/activate
python -m piper.download_voices --download-dir voices en_US-lessac-medium en_US-libritts_r-medium
```

**Manual browser download**:
Visit [piper-voices](https://huggingface.co/rhasspy/piper-voices) and download `.onnx` + `.onnx.json` pairs for desired voices.

Final structure:

```
voices/
├── en_US-lessac-medium.onnx
├── en_US-lessac-medium.onnx.json
├── en_US-libritts_r-medium.onnx
└── en_US-libritts_r-medium.onnx.json
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
