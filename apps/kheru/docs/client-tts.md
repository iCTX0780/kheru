# Client-side offline TTS

Kheru supports **three TTS modes** depending on build flags and whether Gentle is reachable.

## Three modes

| Mode | `VITE_CLIENT_TTS` | `GENTLE_URL` | Synth | Alignment | Highlights |
|------|-------------------|--------------|-------|-----------|------------|
| **Hosted (default)** | `0` | set | `POST /api/generate` (Node Kokoro) | Gentle in same request | Gentle |
| **Hybrid** | `1` | set + reachable | Browser Web Worker | `POST /api/align` after synth | Gentle |
| **Offline** | `1` | unset / down | Browser Web Worker | skipped | Estimated |

Studio loads `GET /api/capabilities` on open to decide hybrid vs offline messaging. `GENTLE_URL` is never exposed to the browser — alignment always goes through the Kheru server.

## Enable client / hybrid mode

```bash
# apps/kheru/.env.local
VITE_CLIENT_TTS=1
```

For **hybrid** (best karaoke with client synth), also run Gentle:

```bash
make dev-gentle   # or GENTLE_URL=http://127.0.0.1:8765 make dev
```

Restart the dev server after changing env vars.

## Architecture

| Concern | Hosted | Hybrid | Offline |
|---------|--------|--------|---------|
| TTS runtime | Node `kokoro-js` CPU | Browser Web Worker | Browser Web Worker |
| Device | `cpu` + `q8` | `webgpu` / `wasm` | `webgpu` / `wasm` |
| Word highlights | Gentle | Gentle via `/api/align` | `playback-words.ts` estimates |
| Paragraph audio | `/api/audio/:runId` | `blob:` URLs | `blob:` URLs |
| Chapter stitch | `POST /api/stitch` | Client `concatWavBlobs` | Client `concatWavBlobs` |
| Export WAV | `/api/export` | Client blob stitch | Client blob stitch |
| Refresh persistence | Server files | OPFS when supported | OPFS when supported |

## API (alignment)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/capabilities` | `{ gentle, client_tts_build }` |
| `POST` | `/api/align` | Multipart `audio` + `transcript` → `{ words[] }` (503 if Gentle down) |

## Bundle impact

`kokoro-js` and `@huggingface/transformers` are **lazy-loaded** on first Generate (or when visiting `/kokoro-spike`). They are not part of the initial studio bundle.

Expect roughly **~5–15 MB** of model weights downloaded on first use (cached by the browser afterward).

## Benchmark spike

Open `/kokoro-spike` to measure model load and generation times on your rehearsal hardware.

## Hosted deployment (future)

Production / AWS EC2 can run the existing Docker Compose stack (`kheru-app` + `kheru-gentle`) with `VITE_CLIENT_TTS=0`, `GENTLE_URL` set, and a persistent volume at `/data`. EC2 runbook and IaC are deferred.

## Electron

Electron is **deferred**. Browser + Web Worker + WebGPU covers offline rehearsal. Revisit only if WebGPU fails on target hardware or offline Gentle becomes mandatory in-browser.

## OPFS

When the Origin Private File System is available, paragraph and chapter WAV blobs are written under `kheru-audio/{projectId}/` so audio can survive page refresh. IndexedDB stores project metadata only.

## Tests

- `/kokoro-spike` — manual WebGPU/WASM benchmark
- `pnpm test` — unit tests for chunking, WAV concat, Gentle bytes align, and export helpers

## TTS text normalization

Before synthesis, script text passes through `prepareTextForTts()`:

- **Glossary** — e.g. `a11y` → accessibility, `DOM` → dome, `DI` → D I, `CI/CD` → C I C D
- **Author overrides** — `DOM [as: document object model]` in the script
- **Chunking** — version strings like `v1.x` and decimals are not treated as sentence ends

Gentle alignment uses the **spoken** transcript so timings match audio. Karaoke may show expanded words (e.g. “accessibility”) where the script says `a11y`.

Edit `src/lib/tts-prepare-text.ts` to extend the built-in glossary.
