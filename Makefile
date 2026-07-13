.PHONY: dev dev-kheru build test lint typecheck kokoro-js-spike

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
