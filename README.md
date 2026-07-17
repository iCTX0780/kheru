# Kheru

Browser multi-speaker TTS studio built with **TanStack Start**. Write a script, assign Kokoro voices, generate offline in the browser, stitch a full mix, and export WAV / ZIP.

Projects live in IndexedDB; audio persists in OPFS when available. Optional Docker packaging serves the same local app — it is not a remote TTS service.

## Quick start (dev)

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru
nvm use   # Node 22+ (see .nvmrc)
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

First synthesis downloads the Kokoro model (~5–15 MB) into the browser.

## Docker (no Node install)

Requires [Docker](https://docs.docker.com/get-docker/) or [OrbStack](https://orbstack.dev/).

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru
docker compose up --build
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

TTS still runs in **your browser**; the container only serves the app.

```bash
# Equivalent one-off
docker build -t kheru:free .
docker run --rm -p 3000:3000 -e HOST=0.0.0.0 -e PORT=3000 kheru:free
```

## What it does

| Step | In the app |
|------|------------|
| Write | Paragraph blocks with voice + speed |
| Generate | One paragraph or full mix |
| Review | Timeline playback, optional word highlights |
| Export | Full mix WAV, paragraph ZIP |

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Dev server |
| `pnpm test` | Unit tests |
| `pnpm typecheck` | TypeScript |
| `pnpm build` | Production build |
| `pnpm start` | Run production server (after build) |

## Feedback

Ideas, bugs, and UX notes are welcome via [GitHub Issues](https://github.com/iCTX0780/kheru/issues). Please include OS, browser, and steps to reproduce when reporting bugs.

## Docs

- [CONTRIBUTING.md](CONTRIBUTING.md) — setup and PR checklist
- [docs/client-tts.md](docs/client-tts.md) — browser Kokoro / OPFS notes

## License

Licensed under the [Apache License 2.0](LICENSE).
