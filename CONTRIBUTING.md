# Contributing to Kheru

Kheru is a TanStack Start app: multi-speaker TTS in the browser (Kokoro), focused on podcast and long-form English (US) episodes.

## Setup

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru
nvm use
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Copy `.env.example` to `.env.local` only if you need overrides. No TTS server env vars are required.

See [docs/client-tts.md](docs/client-tts.md).

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Dev server |
| `pnpm test` | Unit tests |
| `pnpm typecheck` | TypeScript |
| `pnpm build` | Production build |
| `docker compose up --build` | Containerized studio |

## PRs

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] Changes are scoped
- [ ] Tests for non-trivial logic when practical

Match existing patterns (TypeScript, React 19, TanStack Start). Prefer extending `voice-catalog.ts`, `tts-prepare-text.ts`, and `src/lib/` helpers.

Keep this repository focused on the browser studio. Large out-of-tree products (native shells, separate apps) belong in their own repos — open an issue before scaffolding them here.

## License

Licensed under the [Apache License 2.0](LICENSE). By contributing, you agree that your contributions will be licensed under the same terms.
