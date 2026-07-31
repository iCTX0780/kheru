# Kheru desktop app

The desktop build wraps the same client bundle as the web app in a [Tauri](https://tauri.app) shell. TTS, projects, audio, and exports all run locally.

## Build targets

| Platform | Output |
|----------|--------|
| macOS | `.app` bundle + `.dmg` installer |
| Windows | `.msi` + NSIS `.exe` installer |
| Linux | `.AppImage` + `.deb` |

All artifacts land under `src-tauri/target/release/bundle/` after `pnpm tauri:build`.

## Data locations

The webview inside Tauri uses a per-app storage origin. Both IndexedDB (projects) and OPFS (generated audio) live under the platform's WebView data directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/WebKit/com.kheru.studio` and `~/Library/Application Support/com.kheru.studio` |
| Windows | `%LOCALAPPDATA%\com.kheru.studio\EBWebView\` |
| Linux | `~/.local/share/com.kheru.studio` |

Deleting these directories resets all projects and generated audio.

## Icons

Icons live under `src-tauri/icons/` and are committed to the repo. Regenerate any time the brand mark changes:

```bash
pnpm tauri icon <path-to-source.png>
```

Tauri's build refuses to compile if `src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.icns,icon.ico}` are missing.

## Troubleshooting

**Environment sanity check** — always run first before opening a support thread:

```bash
pnpm exec tauri info
```

This should report Tauri v2 across `@tauri-apps/cli` and the Rust `tauri` / `tauri-build` crates. Version drift between the JS and Rust sides is the single most common source of confusing failures.

**Cargo workspace check** — from the repo root:

```bash
cargo metadata --format-version 1 | jq '.workspace_members'
```

Expect a single member matching the `kheru` package in `src-tauri/Cargo.toml`. If it lists nothing or errors, the root `Cargo.toml` workspace declaration is missing.

## Known limitations

- **TTS inference is CPU-only.** The Rust `ort` session uses only the CPU execution provider today; the old browser build's WebGPU path was lost in the migration. On Apple Silicon, short sentences generate in ~1-3s. Wiring up per-platform accelerators (CoreML on macOS, DirectML on Windows, CUDA on Linux/Windows) is tracked in [#14](https://github.com/iCTX0780/kheru/issues/14) and should cut latency to ~200-500ms.

## Web/Docker target still works

The desktop shell is additive. `pnpm dev`, `pnpm build`, `pnpm start`, and `docker compose up` are all unchanged and continue to serve the app through the Nitro server bundle.
