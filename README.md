# Kheru

Open-core multi-speaker TTS studio in the browser. Write a script, assign voices, generate with Kokoro offline, stitch an episode, and export audio plus captions.

**Flagship use:** podcast and spoken-content production (educational explainers, chapter summaries, multi-host scripts). Same studio also works for dialogue and other scripted formats.

**Runs entirely in your browser** — Kokoro TTS is local; projects live in IndexedDB; audio persists in OPFS when available. Optional Docker packaging serves the same local app (not a remote TTS service).

> Monetization plan: free local studio core; paid Player / Cloud later. See [docs/commercial.md](docs/commercial.md).

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/README.md](docs/README.md) | Full doc index (product, roadmap, commercial) |
| [docs/free-docker-split.md](docs/free-docker-split.md) | Free Docker image vs private Pro repos |
| [docs/product-vision.md](docs/product-vision.md) | Positioning and jobs-to-be-done |
| [docs/roadmap.md](docs/roadmap.md) | Now / next / later |
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
| Write | Paragraph / segment blocks with voice + speed |
| Generate | Per-segment or full-mix stitch |
| Review | Timeline playback, optional word highlights |
| Export | WAV, ZIP (MP3 and `.kheru` playpack on the roadmap) |

## Project layout

```
kheru/
├── apps/kheru/           # TanStack Start studio app
├── docs/                 # Product, architecture, commercial strategy
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

# Run the local studio in a container (TTS still runs in the browser)
make docker-build
make docker-run   # http://127.0.0.1:3000
# or: docker compose up --build
```

## Voice catalog

Six curated US Kokoro voices (`kokoro:af_heart`, `kokoro:am_michael`, etc.) — suitable as show hosts / narrators. Preview clips synthesize on demand in the browser.

## License

No root `LICENSE` file yet. Do not assume OSI terms until one is published. Commercial intent: [docs/commercial.md](docs/commercial.md).

## Legacy

`legacy/fastapi/` — retired Python TTS stack (reference only).
