.PHONY: dev dev-kheru build test lint typecheck kokoro-js-spike docker-build docker-run docker-up

WITH_NODE := ./scripts/with-node.sh

kokoro-js-spike:
	$(WITH_NODE) bash -c 'cd scripts/kokoro-js-spike && npm install && node spike.mjs'

dev-kheru:
	$(WITH_NODE) bash -c 'cd apps/kheru && pnpm dev'

dev: dev-kheru

build:
	$(WITH_NODE) pnpm --filter kheru build

test:
	$(WITH_NODE) pnpm --filter kheru test

lint:
	$(WITH_NODE) pnpm --filter kheru exec tsc --noEmit

typecheck:
	$(WITH_NODE) pnpm --filter kheru exec tsc --noEmit

# Free studio image (serves app; TTS runs in the browser).
docker-build:
	docker build -t kheru:free .

docker-run: docker-build
	docker run --rm -p 3000:3000 -e HOST=0.0.0.0 -e PORT=3000 kheru:free

docker-up:
	docker compose up --build
