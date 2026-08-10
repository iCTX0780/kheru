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

## TTS compute backend

Settings → **TTS compute backend** picks which ONNX Runtime execution provider Kokoro runs on:

| Option | Behavior |
|--------|----------|
| Auto (default) | Use the platform accelerator if available, else CPU |
| GPU            | Force the accelerator; warns if none is available and stays on CPU |
| CPU            | Never attach a GPU EP |

Available accelerators today:

| Platform | Accelerator |
|----------|-------------|
| macOS    | CoreML (Apple Neural Engine + GPU) |
| Windows  | *not yet — tracked in [#14](https://github.com/iCTX0780/kheru/issues/14) (DirectML)* |
| Linux    | *not yet — tracked in [#14](https://github.com/iCTX0780/kheru/issues/14) (CUDA)* |

The preference is stored in `<app_config_dir>/tts-backend.json`. Changing it drops the loaded ORT session; the next generation rebuilds with the new EP.

### Known ceiling on macOS today

Even with Auto/GPU on macOS, the stock `Kokoro-82M-v1.0-ONNX` model runs mostly on CPU. ORT's CoreML EP does register — the debug log line reads `[tts] session built with EP=coreml` — but Kokoro was exported with unbounded dynamic input shapes, and CoreML's MLProgram runtime rejects those subgraphs ("unbounded dimension is not supported"). The default `NeuralNetwork` format tolerates unbounded dims but has narrower op coverage, so CoreML claims only a partial subgraph and the rest falls back to CPU. `macmon` will show CPU-dominant utilization regardless.

Meaningful macOS acceleration needs either a bounded-shape ONNX re-export (fix the max `seq_len`) or a native `.mlpackage` conversion via coremltools. Tracked in [#14](https://github.com/iCTX0780/kheru/issues/14).

## Web/Docker target still works

The desktop shell is additive. `pnpm dev`, `pnpm build`, `pnpm start`, and `docker compose up` are all unchanged and continue to serve the app through the Nitro server bundle.
