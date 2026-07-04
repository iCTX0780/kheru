# VoxLab

Local, offline text-to-speech rehearsal studio. Paste a `Speaker: dialogue` script, assign voices per character, and generate a stitched WAV using Piper TTS.

## Structure

```
tts/
├── apps/
│   ├── api/          # FastAPI backend + Docker
│   └── web/          # React + Vite frontend
├── voices/           # Piper models (git-ignored; see Setup)
├── download_voices.py
└── Makefile
```

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
nvm use          # Node 22
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
| GET | `/api/voices` | List available voices |
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
