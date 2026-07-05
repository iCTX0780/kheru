#!/usr/bin/env bash
# Run a command with nvm + repo .nvmrc (lts/jod). Avoids zsh FUNCNEST recursion.
set -euo pipefail

export FUNCNEST=500
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
else
  echo "nvm not found at $NVM_DIR/nvm.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
nvm use

exec "$@"
