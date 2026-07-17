#!/usr/bin/env bash
# Print the Kheru usage guide (friend / Docker Hub onboarding).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
GUIDE="$ROOT/docs/how-to-use.md"

if [[ ! -f "$GUIDE" ]]; then
  echo "Missing $GUIDE" >&2
  exit 1
fi

if command -v bat >/dev/null 2>&1; then
  bat --style=plain --paging=never "$GUIDE"
elif command -v less >/dev/null 2>&1 && [[ -t 1 ]]; then
  less -R "$GUIDE"
else
  cat "$GUIDE"
fi
