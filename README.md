# Kheru

Open-core multi-speaker TTS studio in the browser. Write a script, assign voices, generate with Kokoro offline, stitch an episode, and export audio.

**Flagship use:** podcast and spoken-content production. Same studio also works for dialogue and other scripted formats.

**Runs entirely in your browser** — Kokoro TTS is local; projects live in IndexedDB; audio persists in OPFS when available. Optional Docker packaging serves the same local app (not a remote TTS service).

## Quick start

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru

nvm use
pnpm install
make dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

First Kokoro synthesis downloads the model (~5–15 MB).

### Docker

```bash
make docker-build
make docker-run   # http://127.0.0.1:3000
# or: docker compose up --build
```

## What it does

| Step | In the app |
|------|------------|
| Write | Paragraph / segment blocks with voice + speed |
| Generate | Per-segment or full-mix stitch |
| Review | Timeline playback, optional word highlights |
| Export | WAV, ZIP |

## Project layout

```
kheru/
├── apps/kheru/           # TanStack Start studio app
├── Makefile
└── package.json
```

## Docs in this repo

Only engineering notes that ship with the free studio:

- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, PRs, issues
- [apps/kheru/docs/client-tts.md](apps/kheru/docs/client-tts.md) — browser Kokoro, OPFS, export

Product / roadmap / commercial docs are **not** published in this repository.

## Voice catalog

Six curated US Kokoro voices (`kokoro:af_heart`, `kokoro:am_michael`, etc.). Preview clips synthesize on demand in the browser.

## License

No root `LICENSE` file yet. Do not assume OSI terms until one is published.

## Legacy

`legacy/fastapi/` — retired Python TTS stack (reference only).
