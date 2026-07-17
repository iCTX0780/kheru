# Kheru

Browser multi-speaker TTS studio built with **TanStack Start**. Write a script, assign Kokoro voices, generate offline in the browser, stitch a full mix, and export WAV / ZIP.

Projects live in IndexedDB; audio persists in OPFS when available. Docker only packages the local app — it is not a remote TTS service.

## Quick start

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru
nvm use
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

First synthesis downloads the Kokoro model (~5–15 MB).

### Docker

```bash
docker compose up --build
# http://127.0.0.1:3000
```

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Dev server |
| `pnpm test` | Unit tests |
| `pnpm typecheck` | TypeScript |
| `pnpm build` | Production build |
| `pnpm start` | Run production server (after build) |

## Layout

```
kheru/
├── src/                 # TanStack Start studio
├── public/
├── docs/client-tts.md   # Browser Kokoro / OPFS notes
├── Dockerfile
└── docker-compose.yml
```

## License

No root `LICENSE` file yet. Do not assume OSI terms until one is published.
