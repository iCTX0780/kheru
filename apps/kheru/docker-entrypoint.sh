#!/bin/sh
set -eu

GENTLE_WAIT_URL="${GENTLE_URL:-}"
GENTLE_WAIT_SECS="${GENTLE_WAIT_SECS:-180}"

wait_for_gentle() {
  url="${1%/}"
  deadline=$(( $(date +%s) + GENTLE_WAIT_SECS ))
  echo "Waiting for Gentle at ${url} (up to ${GENTLE_WAIT_SECS}s)..."

  while true; do
    if curl -sf "${url}/" >/dev/null 2>&1; then
      echo "Gentle is ready."
      return 0
    fi

    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "Gentle not ready after ${GENTLE_WAIT_SECS}s — starting without forced alignment."
      return 1
    fi

    sleep 2
  done
}

if [ -n "$GENTLE_WAIT_URL" ]; then
  wait_for_gentle "$GENTLE_WAIT_URL" || true
fi

exec node .output/server/index.mjs
