# Kheru

Offline rehearsal studio for scripted dialogue. Write paragraph-by-paragraph, assign Kokoro voices, generate audio, and play back with word-level highlighting.

One TanStack Start app — UI, TTS API, and file storage in a single Node process.

## Quick start

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru

nvm use
pnpm install
make dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

First Kokoro synthesis downloads the model (~30s).

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
├── legacy/               # Archived Python stack and bake-off scripts
├── scripts/              # generate_voice_samples.py, voice_bakeoff.py
├── voice-bakeoff/        # Comparison WAVs + index.html (local, git-ignored)
├── Makefile
└── package.json          # pnpm workspace root
```

## Setup

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
make docker-up    # build, start detached, print compose ps (Gentle :8765, app :3000)
make docker-logs  # follow logs
make docker-down
```

Containers are named `kheru-<service>-1` (e.g. `kheru-app-1`, `kheru-gentle-1`).

Persists generated audio and the Kokoro model cache in `apps/kheru/data/`.

## Voice catalog

Six curated US Kokoro voices (`kokoro:af_heart`, `kokoro:am_michael`, etc.).

To regenerate preview clips (optional — previews are also generated on demand via `/api/voice-preview`):

```bash
make voice-samples     # → apps/kheru/public/voice-samples/ (legacy static export)
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
| `DATA_DIR` | `apps/kheru/data` | Projects, audio, Kokoro cache |
| `TRANSFORMERS_CACHE` | `data/transformers-cache` | Kokoro model cache |
| `GENTLE_URL` | — | Gentle aligner base URL (e.g. `http://127.0.0.1:8765`) |

## Legacy

- `legacy/fastapi/` — retired FastAPI stack (Python TTS reference for bake-off scripts)
- `legacy/tts_generator.py` — original flat-file MVP
