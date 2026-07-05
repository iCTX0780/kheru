# Kheru

Offline rehearsal studio for scripted dialogue. Write paragraph-by-paragraph, assign Piper or Kokoro voices, generate audio, and play back with word-level highlighting.

One TanStack Start app — UI, TTS API, and file storage in a single Node process.

## Quick start

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru

nvm use
pnpm install
make dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

First Kokoro synthesis downloads the model (~30s). Piper voices need the `piper` CLI on your PATH.

## What it does

| Step | In the app |
|------|------------|
| Write | Paragraph blocks with inline voice + speed per block |
| Generate | Per-paragraph or full chapter stitch |
| Play | Segmented timeline, word highlights (Gentle when available) |
| Export | WAV, MP3, SRT, ZIP via `/api/export` |

## Project layout

```
kheru/
├── apps/kheru/           # TanStack Start app (studio UI + /api routes + server/tts)
├── legacy/fastapi/       # Archived Python API — bake-off scripts only
├── voices/               # Piper .onnx models (git-ignored)
├── kokoro-models/        # Optional local Kokoro ONNX (bake-off)
├── scripts/              # voice_bakeoff.py, generate_voice_samples.py
├── voice-bakeoff/        # Comparison WAVs + index.html (local, git-ignored)
├── Makefile
└── package.json          # pnpm workspace root
```

## Setup

### Voice models (Piper)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install piper-tts
python download_voices.py   # → voices/
```

### Dev server

```bash
make dev          # http://127.0.0.1:3000
make build        # production build
make start        # run built server
make test         # vitest
```

### Word highlights (Gentle)

Forced alignment gives accurate word-by-word highlights. Without Gentle, highlights are estimated from clip duration.

**Local dev** — run Gentle in a separate container:

```bash
docker run --rm -p 8765:8765 lowerquality/gentle
GENTLE_URL=http://127.0.0.1:8765 make dev
```

**Docker Compose** — Gentle starts first, Kheru waits until it is healthy:

```bash
make docker-up    # Gentle :8765, Kheru :3000
make docker-down
```

Mounts `voices/` read-only and persists generated audio in `apps/kheru/data/`.

## Voice catalog

Curated US voices: 6 Piper + 4 Kokoro (`kokoro:af_heart`, `piper:en_US-lessac-high`, etc.).

To compare candidates before changing the catalog:

```bash
cd legacy/fastapi && pip install -r requirements.txt
make voice-bakeoff     # → voice-bakeoff/
make voice-samples     # → apps/kheru/public/voice-samples/
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/voices` | Curated voice list |
| `POST` | `/api/generate` | `{ conversation: Turn[] }` → `{ run_id, audio_url, segments, words }` |
| `GET` | `/api/audio/:run_id` | Stream WAV (8-char hex id) |
| `POST` | `/api/export` | Export chapter or paragraphs (WAV, MP3, SRT, ZIP) |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `apps/kheru/data` | Projects, audio, cache |
| `VOICES_DIR` | `voices/` | Piper model directory |
| `TRANSFORMERS_CACHE` | `data/transformers-cache` | Kokoro model cache |
| `GENTLE_URL` | — | Gentle aligner base URL (e.g. `http://127.0.0.1:8765`) |

## Legacy

- `legacy/fastapi/` — retired FastAPI stack (Python TTS reference for bake-off scripts)
- `legacy/tts_generator.py` — original flat-file MVP
