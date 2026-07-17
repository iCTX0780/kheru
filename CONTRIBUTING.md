# Contributing to Kheru

Thank you for helping improve Kheru. This project turns scripts into multi-speaker spoken audio in the browser (Kokoro), with a focus on podcast and long-form English (US) episodes.

## Before you start

1. Read [apps/kheru/docs/client-tts.md](apps/kheru/docs/client-tts.md) for how client TTS works.
2. Set up the dev environment (below).
3. For non-trivial work, **open an issue first** — especially for new voices, locales, or TTS engines.

## Development setup

```bash
git clone https://github.com/iCTX0780/kheru.git && cd kheru
nvm use
pnpm install
make dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

First Kokoro synthesis downloads the model in the browser (~5–15 MB).

### Useful commands

| Command | Purpose |
|---------|---------|
| `make dev` | Dev server (studio UI; TTS runs in the browser) |
| `make test` | Unit tests |
| `make typecheck` | TypeScript check |
| `make build` | Production build |
| `make docker-build` / `make docker-run` | Run the same studio in Docker |

### Environment

Copy `apps/kheru/.env.example` to `apps/kheru/.env.local` if you need local overrides. Kokoro runs in the browser — no TTS server env vars are required. Do not commit secrets or local `.env` files.

## How to contribute

### Small fixes

Typos, test gaps, clear bugs with reproduction steps — PRs welcome without a prior issue.

### Features and larger changes

1. Open a [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) (or comment on an existing one).
2. Wait for maintainer feedback on approach — especially for locale/dialect work.
3. Fork, branch, implement, test.
4. Open a PR against `main` with a clear description and test plan.

### Pull request checklist

- [ ] `make test` passes
- [ ] `make typecheck` passes
- [ ] Changes are scoped to the stated issue
- [ ] New behavior has tests when practical (glossary, chunking, export)
- [ ] User-facing changes are noted in PR description

### Code style

- Match existing patterns in the file you edit (TypeScript, React 19, TanStack Start).
- Prefer extending `voice-catalog.ts`, `tts-prepare-text.ts`, and shared `lib/` helpers over duplicating logic in components.
- Keep comments for non-obvious business rules only.
- Minimize diff size — do not refactor unrelated code in the same PR.

### Branch naming (suggested)

- `fix/short-description`
- `feat/short-description`
- `docs/short-description`

## Issues and feature requests

### Bug reports

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). Include steps, expected vs actual, browser and OS, and logs (redact private script text).

**Good bug:** "Generate all on a 12-paragraph script stalls after paragraph 8 in Chrome 138 on macOS — console shows OPFS write failure."

**Weak bug:** "Generate doesn't work."

### Feature requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml). Include the problem, proposed approach, and whether it is locale/voice related.

### Project focus (what we prioritize)

**In scope:** podcast/long-form quality (stitch, export), English speech quality, Kokoro voice curation, browser-local TTS, playback sync, documentation and tests.

**Discuss before building:** new TTS engines, non-English languages, large UI redesigns, hosted SaaS / Stripe, Tauri or Expo scaffolds. **Never add `apps/kheru-player` here** — Player lives in private [`iCTX0780/kheru-player`](https://github.com/iCTX0780/kheru-player).

**Likely out of scope:** voice cloning pipelines, real-time conversational TTS, defaulting to third-party cloud APIs for script text, HTML/LRC lyrics export workarounds.

## Collaborators

Invite people to **`kheru` only**. Do not invite free-studio collaborators to `kheru-player` or any private product-docs repo.

## Reporting security issues

Do not open public issues for security vulnerabilities. Email the maintainer privately (see GitHub profile contact) with steps to reproduce.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project. (Check the repository root for a `LICENSE` file before submitting.)

## Recognition

Contributors are credited in PR history.
