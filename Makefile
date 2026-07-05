.PHONY: dev dev-web dev-api dev-kheru start-kheru build lint typecheck docker-up docker-down voice-samples voice-bakeoff kokoro-js-spike

WITH_NODE := ./scripts/with-node.sh

voice-bakeoff:
	cd apps/api && PATH="$$(pwd)/.venv/bin:$$PATH" .venv/bin/python3.14 ../../scripts/voice_bakeoff.py

voice-samples:
	cd apps/api && PATH="$$(pwd)/.venv/bin:$$PATH" .venv/bin/python3.14 ../../scripts/generate_voice_samples.py

kokoro-js-spike:
	$(WITH_NODE) bash -c 'cd scripts/kokoro-js-spike && npm install && node spike.mjs'

dev-web:
	$(WITH_NODE) pnpm --filter web dev

dev-kheru:
	$(WITH_NODE) bash -c 'cd apps/kheru && DATA_DIR="$$(pwd)/data" GENTLE_URL="$${GENTLE_URL:-}" pnpm dev'

start-kheru:
	$(WITH_NODE) bash -c 'cd apps/kheru && TRANSFORMERS_CACHE="$${TRANSFORMERS_CACHE:-./data/transformers-cache}" PORT="$${PORT:-3000}" HOST="$${HOST:-127.0.0.1}" node .output/server/index.mjs'

dev-api:
	cd apps/api && PATH="$$(pwd)/.venv/bin:$$PATH" .venv/bin/python3.14 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000

dev:
	@echo "Run 'make dev-api' and 'make dev-web' in separate terminals"

build:
	$(WITH_NODE) pnpm --filter web build

lint:
	$(WITH_NODE) pnpm --filter web lint

typecheck:
	$(WITH_NODE) pnpm --filter web exec tsc -p tsconfig.app.json --noEmit

docker-up:
	cd apps/api && docker compose up --build

docker-down:
	cd apps/api && docker compose down
