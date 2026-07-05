# Kheru

Self-contained TanStack Start rehearsal studio (Kokoro + Piper TTS, no FastAPI).

## Dev

From repo root:

```bash
make dev-kheru
# → http://127.0.0.1:3000
```

Requires `piper` on PATH for Piper fallback voices. Kokoro downloads models on first generate (~30s).

### Word highlights (Gentle)

Accurate word-by-word highlighting uses [Gentle](https://github.com/lowerquality/gentle) forced alignment. Without it, highlights are estimated from clip duration and can finish before speech ends.

**Local dev with Gentle:**

```bash
docker run --rm -p 8765:8765 lowerquality/gentle
GENTLE_URL=http://127.0.0.1:8765 make dev-kheru
```

Docker Compose starts Gentle automatically (`GENTLE_URL=http://gentle:8765`).

## Production

```bash
pnpm --filter kheru build
cd apps/kheru
TRANSFORMERS_CACHE=./data/transformers-cache PORT=3000 node .output/server/index.mjs
```

## Docker

```bash
docker compose -f apps/kheru/docker-compose.yml up --build
```

Mounts repo `voices/` for Piper and persists `apps/kheru/data/` for projects and generated audio.

## API (legacy-compatible)

| Route | Method | Notes |
|-------|--------|-------|
| `/api/voices` | GET | Curated catalog |
| `/api/generate` | POST | `{ conversation: Turn[] }` → `{ run_id, audio_url, segments, words }` |
| `/api/audio/:runId` | GET | 8-char hex WAV |
