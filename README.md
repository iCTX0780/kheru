# Kheru

Local, offline text-to-speech rehearsal studio. Write paragraph dialogue, assign Piper or Kokoro voices, and generate stitched audio for rehearsal.

Single TanStack Start app — no separate FastAPI service.

## Structure

```
tts/
├── apps/
│   └── kheru/        # TanStack Start studio + TTS API (kokoro-js + piper)
├── legacy/
│   └── fastapi/      # Archived Python API (used by voice bake-off scripts only)
├── voices/           # Piper models (git-ignored; see Setup)
├── kokoro-models/    # Kokoro ONNX models (git-ignored; optional for bake-off)
├── scripts/          # voice_bakeoff.py, generate_voice_samples.py
└── Makefile
```

## Voice bake-off

Compare Piper and Kokoro voices locally before changing the studio catalog:

```bash
cd legacy/fastapi && pip install -r requirements.txt
make voice-bakeoff    # writes voice-bakeoff/ + index.html
make voice-samples    # curated previews → apps/kheru/public/voice-samples/
```

Open `voice-bakeoff/index.html` in a browser. Results and keep/drop notes live in `voice-bakeoff/RESULTS.md` (local, git-ignored).

**Curated catalog:** 6 Piper + 4 Kokoro US voices (`piper:en_US-joe-medium`, `kokoro:af_heart`, etc.).

## Setup

### 1. Voice models

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install piper-tts
python download_voices.py
```

Models land in `voices/` as `.onnx` + `.onnx.json` pairs.

### 2. Node

```bash
nvm use          # lts/jod (Node 22) — or: source scripts/with-node.sh true
pnpm install
```

Requires `piper` on PATH for Piper fallback voices.

## Development

```bash
make dev          # or: make dev-kheru → http://127.0.0.1:3000
```

First Kokoro generate downloads the model (~30s). Subsequent runs are faster.

Production build:

```bash
pnpm --filter kheru build
make start-kheru
```

## Docker

```bash
make docker-up    # Gentle on :8765, Kheru on :3000
```

Compose starts Gentle, waits for it to become healthy, then starts Kheru. The Kheru entrypoint also polls `GENTLE_URL` before serving. Mounts repo `voices/` for Piper and persists `apps/kheru/data/`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/voices` | List curated voices (`id`, `engine`, `display_name`, …) |
| POST | `/api/generate` | Generate conversation audio → `{ run_id, audio_url, segments }` |
| GET | `/api/audio/{run_id}` | Stream generated WAV |
| POST | `/api/export` | Export chapter/paragraphs (WAV, MP3, SRT, ZIP) |

## Legacy

- `legacy/fastapi/` — archived FastAPI stack (retired in Phase B cutover)
- `legacy/tts_generator.py` — original flat MVP scripts
