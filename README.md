# VoxLab

Local, offline text-to-speech rehearsal studio. Write paragraph dialogue, assign Piper or Kokoro voices, and generate stitched WAV for rehearsal.

## Structure

```
tts/
├── apps/
│   ├── api/          # FastAPI backend (Piper + Kokoro) + Docker
│   └── web/          # React + Vite frontend
├── voices/           # Piper models (git-ignored; see Setup)
├── kokoro-models/    # Kokoro ONNX models (git-ignored; see Voice bake-off)
├── scripts/          # voice_bakeoff.py, generate_voice_samples.py
└── Makefile
```

## Voice bake-off

Compare Piper and Kokoro voices locally before changing the studio catalog:

```bash
cd apps/api && pip install -r requirements.txt
make voice-bakeoff    # writes voice-bakeoff/ + index.html
make voice-samples    # curated previews → apps/web/public/voice-samples/
```

Open `voice-bakeoff/index.html` in a browser. Results and keep/drop notes live in `voice-bakeoff/RESULTS.md` (local, git-ignored).

**Curated catalog:** 6 Piper + 4 Kokoro US voices (`piper:en_US-joe-medium`, `kokoro:af_heart`, etc.).

**Deferred:** TanStack Start migration, Gentle alignment, and FastAPI retirement wait until the curated catalog is stable in the current stack.

## Setup

### 1. Voice models

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install piper-tts
python download_voices.py
```

Models land in `voices/` as `.onnx` + `.onnx.json` pairs.

### 2. Frontend

```bash
nvm use          # lts/jod (Node 22) — or: source scripts/with-node.sh true
pnpm install
```

### 3. Backend

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Development

Run API and web in separate terminals:

```bash
make dev-api    # http://localhost:8000
make dev-web    # http://localhost:5173 (proxies /api to :8000)
```

Or with Docker:

```bash
make docker-up  # API + legacy HTML UI at http://localhost:8000
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/voices` | List curated voices (`id`, `engine`, `display_name`, …) |
| GET | `/api/speakers` | List saved speaker profiles |
| POST | `/api/speakers` | Save a speaker profile |
| DELETE | `/api/speakers/{name}` | Delete a profile |
| POST | `/api/generate` | Generate conversation audio |
| GET | `/api/audio/{run_id}` | Download generated WAV |

## Script format

```
Alice: Hello, welcome to the interview.
Bob: Thanks for having me.
```

## Legacy MVP

The original flat MVP scripts live in `legacy/` for reference.
