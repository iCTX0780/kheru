# Kheru

Open-source offline rehearsal studio for scripted dialogue. Write paragraph-by-paragraph, assign Kokoro voices, generate audio in the browser, and play back with word-level highlighting.

**Client-only** — no server TTS, no Docker, no API routes. Projects live in IndexedDB; audio persists in OPFS when available.

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/README.md](docs/README.md) | Overview, concepts, doc index |
| [docs/architecture.md](docs/architecture.md) | System design, how to extend |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev setup, PRs, issues |
| [apps/kheru/docs/client-tts.md](apps/kheru/docs/client-tts.md) | Browser Kokoro, OPFS, export |

## Quick start

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru

nvm use
pnpm install
make dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

First Kokoro synthesis downloads the model (~5–15 MB).

## What it does

| Step | In the app |
|------|------------|
| Write | Paragraph blocks with voice + speed per block |
| Generate | Per-paragraph or full chapter stitch (browser Kokoro) |
| Play | Segmented timeline, estimated word highlights |
| Export | WAV, SRT, ZIP (client-side download) |

## Project layout

```
kheru/
├── apps/kheru/           # TanStack Start studio app
├── legacy/               # Archived Python stack
├── Makefile
└── package.json
```

## Setup

```bash
make dev          # http://127.0.0.1:3000
make build        # production build
make test         # vitest
make typecheck    # tsc --noEmit
```

## Voice catalog

Six curated US Kokoro voices (`kokoro:af_heart`, `kokoro:am_michael`, etc.). Preview clips synthesize on demand in the browser.

## Legacy

`legacy/fastapi/` — retired Python TTS stack (reference only).
