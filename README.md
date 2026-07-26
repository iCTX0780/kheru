<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/kheru-wordmark-white.png">
    <img alt="Kheru" src="docs/brand/kheru-wordmark.png" width="320">
  </picture>
</p>

<p align="center">
  Browser multi-speaker TTS studio built with <strong>TanStack Start</strong>.<br>
  Write a script, assign Kokoro voices, generate offline in the browser, stitch a full mix, and export WAV / ZIP.
</p>

<p align="center">
  <img alt="Node 22+" src="https://img.shields.io/badge/node-22%2B-7F3CF2">
  <img alt="TanStack Start" src="https://img.shields.io/badge/TanStack-Start-7F3CF2">
  <img alt="License Apache 2.0" src="https://img.shields.io/badge/license-Apache%202.0-7F3CF2">
</p>

---

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
docker build -t kheru .
docker run --rm -p 3000:3000 -e HOST=0.0.0.0 -e PORT=3000 kheru
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

- [How to use](docs/how-to-use.md) — walkthrough for new users (`./how-to-use.sh`)
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup and PR checklist
- [docs/client-tts.md](docs/client-tts.md) — browser Kokoro / OPFS notes

## Brand

<img alt="Kheru icon" src="docs/brand/kheru-icon.png" width="72" align="left" hspace="16">

The mark is the word **KHERU** in a capsule with a rule beneath — the rule stands
in for the cartouche tie. Use the full wordmark where there's room; the square
**K** icon is for compact contexts (app icon, favicon, in-app header).

<br clear="left">

| Token | Value | Use |
|-------|-------|-----|
| Violet | `#7F3CF2` — `oklch(0.55 0.25 293)` | The mark, primary UI |
| Paper | `#FFFFFF` | Knockout, grounds |

Violet-on-white / white-on-violet is **5.48:1** (WCAG AA). **Never place the mark
on black** (3.83:1 fails AA) — use the white knockout on dark grounds instead.

Logo masters ship in [`public/logos/`](public/logos) (`kheru.svg`,
`kheru-white.svg`, `kheru-icon-rounded.svg`); PWA icons, favicon, and the social
card are in [`public/icons/`](public/icons) and [`public/social/`](public/social).
In app, the wordmark is available as the theme-aware `KheruWordmark` component.

## License

Licensed under the [Apache License 2.0](LICENSE).
