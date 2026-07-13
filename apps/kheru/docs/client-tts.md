# Client-side TTS

Kheru is a **client-only** rehearsal studio. Kokoro runs in a browser Web Worker (WebGPU or WASM). There is no server TTS, Gentle alignment, or `/api/*` backend.

## Architecture

| Concern | Implementation |
|---------|----------------|
| Synth | `src/lib/client-tts/worker.ts` — lazy-loaded Kokoro |
| Device | WebGPU when available, otherwise WASM |
| Word highlights | Estimated via `playback-words.ts` |
| Paragraph audio | `blob:` URLs + OPFS persistence |
| Chapter stitch | Client `concatWavBlobs` |
| Export | Client WAV, ZIP, SRT/VTT |
| Projects | IndexedDB (`project-db.ts`) |

## Development

```bash
make dev
# or
cd apps/kheru && pnpm dev
```

Open http://127.0.0.1:3000 — no env vars required.

## Bundle impact

`kokoro-js` and `@huggingface/transformers` lazy-load on first Generate. Expect ~5–15 MB of model weights on first use (browser-cached afterward).

## Benchmark spike

Open `/kokoro-spike` to measure model load and generation times on your hardware.

## OPFS

When available, paragraph and chapter WAV blobs persist under `kheru-audio/{projectId}/` so audio can survive refresh. IndexedDB stores project metadata.

## TTS text normalization

Before synthesis, script text passes through `prepareTextForTts()`:

- **Glossary** — e.g. `a11y` → accessibility, `API` → letter spelling
- **Author overrides** — `DOM [as: document object model]` in the script
- **Chunking** — version strings like `v1.x` are not treated as sentence ends

Karaoke uses estimated word timing from playback progress, not phoneme alignment.

## Tests

- `/kokoro-spike` — manual WebGPU/WASM benchmark
- `pnpm test` — unit tests for chunking, WAV concat, export helpers
