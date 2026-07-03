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

Visit [OHF Voice releases](https://github.com/OHF-Voice/piper1-gpl/releases) (Piper development moved here).

**Quick option** — use the helper script:

```bash
python download_voices.py
```

**Manual option** — download and extract directly:

```bash
mkdir -p voices
curl -sSL https://github.com/OHF-Voice/piper1-gpl/releases/download/2024.1.1/en_US-ryan-medium.tar.gz | tar xz -C voices/
curl -sSL https://github.com/OHF-Voice/piper1-gpl/releases/download/2024.1.1/en_US-amy-medium.tar.gz | tar xz -C voices/
```

Final structure:

```
voices/
├── en_US-ryan-medium/
│   ├── en_US-ryan-medium.onnx
│   └── en_US-ryan-medium.onnx.json
└── en_US-amy-medium/
    ├── en_US-amy-medium.onnx
    └── en_US-amy-medium.onnx.json
```

Or flatten them (rename model paths in `conversation.json` accordingly):

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
