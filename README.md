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

**Local dev** — start Gentle via Compose (named `kheru-gentle` in OrbStack/Docker), then run the app on the host:

```bash
make gentle-up                              # kheru-gentle on :8765, waits for healthcheck
GENTLE_URL=http://127.0.0.1:8765 make dev   # or: make dev-gentle (starts Gentle + dev in one step)
make gentle-down                            # stop aligner when done
```

**Full stack in Docker** — Gentle starts first, Kheru waits until it is healthy:

```bash
make docker-up    # kheru-gentle :8765 + kheru-app :3000
make docker-logs  # follow logs
make docker-down
```

Compose containers are named `kheru-gentle` and `kheru-app`.

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
| `GET` | `/api/capabilities` | `{ gentle, client_tts_build }` — alignment and build flags |
| `POST` | `/api/generate` | `{ conversation: Turn[] }` → `{ run_id, audio_url, segments, words }` (hosted mode) |
| `POST` | `/api/align` | Multipart `audio` + `transcript` → `{ words }` (hybrid client TTS + Gentle) |
| `GET` | `/api/audio/:run_id` | Stream WAV (8-char hex id) |
| `POST` | `/api/export` | Export chapter or paragraphs (WAV, MP3, SRT, ZIP) |
| `POST` | `/api/stitch` | Concat paragraph run ids into chapter mix |

### TTS modes

| Mode | Env | Best for |
|------|-----|----------|
| **Hosted** | `VITE_CLIENT_TTS=0`, `GENTLE_URL` set | Production, MP3 export, no browser model download |
| **Hybrid** | `VITE_CLIENT_TTS=1`, `GENTLE_URL` set | Local rehearsal with client synth + Gentle karaoke |
| **Offline** | `VITE_CLIENT_TTS=1`, no Gentle | Fully local synth; estimated highlights only |

See [apps/kheru/docs/client-tts.md](apps/kheru/docs/client-tts.md) for client TTS details.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `apps/kheru/data` | Projects, audio, Kokoro cache |
| `TRANSFORMERS_CACHE` | `data/transformers-cache` | Kokoro model cache |
| `GENTLE_URL` | — | Gentle aligner base URL (e.g. `http://127.0.0.1:8765`) |
| `VITE_CLIENT_TTS` | `0` | `1` = browser Kokoro worker; use with `/api/align` for hybrid karaoke |

## Legacy

- `legacy/fastapi/` — retired FastAPI stack (Python TTS reference for bake-off scripts)
- `legacy/tts_generator.py` — original flat-file MVP
