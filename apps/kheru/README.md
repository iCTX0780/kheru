# Kheru

Self-contained TanStack Start rehearsal studio (Kokoro + Piper TTS).

## Dev

From repo root:

```bash
make dev-kheru
# → http://127.0.0.1:3000
```

Requires `piper` on PATH for Piper fallback voices. Kokoro downloads models on first generate (~30s).

### Word highlights (Gentle)

Accurate word-by-word highlighting uses [Gentle](https://github.com/lowerquality/gentle) forced alignment. Without it, highlights are estimated from clip duration.

**Local dev with Gentle:**

```bash
docker run --rm -p 8765:8765 lowerquality/gentle
GENTLE_URL=http://127.0.0.1:8765 make dev-kheru
```

## Production

```bash
pnpm --filter kheru build
make start-kheru
```

## Docker

Compose starts **Gentle first**, waits until it is healthy, then starts Kheru (entrypoint also polls `GENTLE_URL`):

```bash
make docker-up    # http://localhost:3000, Gentle on :8765
```

Mounts repo `voices/` for Piper and persists `apps/kheru/data/` for projects and generated audio.

## API

| Route | Method | Notes |
|-------|--------|-------|
| `/api/voices` | GET | Curated catalog |
| `/api/generate` | POST | `{ conversation: Turn[] }` → `{ run_id, audio_url, segments, words }` |
| `/api/audio/:runId` | GET | 8-char hex WAV |
| `/api/export` | POST | Export chapter/paragraphs |
