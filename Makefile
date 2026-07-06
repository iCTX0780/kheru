.PHONY: dev dev-kheru start start-kheru build test lint typecheck docker-up docker-logs docker-down voice-samples voice-bakeoff kokoro-js-spike

WITH_NODE := ./scripts/with-node.sh

voice-bakeoff:
	cd legacy/fastapi && PATH="$$(pwd)/.venv/bin:$$PATH" .venv/bin/python3.14 ../../scripts/voice_bakeoff.py

voice-samples:
	cd legacy/fastapi && PATH="$$(pwd)/.venv/bin:$$PATH" .venv/bin/python3.14 ../../scripts/generate_voice_samples.py

kokoro-js-spike:
	$(WITH_NODE) bash -c 'cd scripts/kokoro-js-spike && npm install && node spike.mjs'

dev-kheru:
	$(WITH_NODE) bash -c 'cd apps/kheru && DATA_DIR="$$(pwd)/data" GENTLE_URL="$${GENTLE_URL:-}" pnpm dev'

dev: dev-kheru

start-kheru:
	$(WITH_NODE) bash -c 'cd apps/kheru && TRANSFORMERS_CACHE="$${TRANSFORMERS_CACHE:-./data/transformers-cache}" PORT="$${PORT:-3000}" HOST="$${HOST:-127.0.0.1}" node .output/server/index.mjs'

start: start-kheru

build:
	$(WITH_NODE) pnpm --filter kheru build

test:
	$(WITH_NODE) pnpm --filter kheru test

lint:
	$(WITH_NODE) pnpm --filter kheru exec tsc --noEmit

typecheck:
	$(WITH_NODE) pnpm --filter kheru exec tsc --noEmit

COMPOSE := docker compose -p kheru -f apps/kheru/docker-compose.yml

docker-up:
	$(COMPOSE) up --build -d
	$(COMPOSE) ps

docker-logs:
	$(COMPOSE) logs -f

docker-down:
	$(COMPOSE) down
