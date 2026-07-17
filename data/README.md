# Local data directory

Browser projects live in **IndexedDB** / OPFS, not here.

Any `projects.json` / `generations.json` under this folder are **local-only** leftovers from older server stacks — they are gitignored and must not be committed (they may contain private scripts).
