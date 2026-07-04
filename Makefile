.PHONY: dev dev-web dev-api build lint typecheck docker-up docker-down voice-samples

voice-samples:
	cd apps/api && PATH="$$(pwd)/.venv/bin:$$PATH" .venv/bin/python3.14 ../../scripts/generate_voice_samples.py

dev-web:
	cd apps/web && pnpm dev

dev-api:
	cd apps/api && PATH="$$(pwd)/.venv/bin:$$PATH" .venv/bin/python3.14 -m uvicorn app:app --reload --host 127.0.0.1 --port 8000

dev:
	@echo "Run 'make dev-api' and 'make dev-web' in separate terminals"

build:
	pnpm --filter web build

lint:
	pnpm --filter web lint

typecheck:
	pnpm --filter web exec tsc -p tsconfig.app.json --noEmit

docker-up:
	cd apps/api && docker compose up --build

docker-down:
	cd apps/api && docker compose down
