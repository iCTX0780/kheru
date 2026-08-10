#!/usr/bin/env node
// Downloads the Kokoro TTS model files from Hugging Face into
// src-tauri/resources/models/kokoro so they can be bundled with the
// Tauri desktop app for offline-from-launch operation.
//
// Idempotent: skips files that already exist locally with a matching size.
// Run implicitly by `pnpm build:tauri`; can also be invoked directly.

import { mkdir, stat, writeFile, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const REVISION = 'main'

const __dirname = dirname(fileURLToPath(import.meta.url))
// transformers.js resolves local files as `${localModelPath}${modelId}/${filename}`,
// so mirror the HF repo layout under the model ID inside resources/models/.
const OUT_DIR = resolve(__dirname, '..', 'src-tauri', 'resources', 'models', MODEL_ID)

const HF_API = `https://huggingface.co/api/models/${MODEL_ID}/tree/${REVISION}?recursive=true`
const HF_RESOLVE = (path) =>
  `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/${path}`

async function listRepoFiles() {
  const res = await fetch(HF_API)
  if (!res.ok) {
    throw new Error(`HF tree API failed: ${res.status} ${res.statusText}`)
  }
  const entries = await res.json()
  return entries
    .filter((e) => e.type === 'file')
    .map((e) => ({ path: e.path, size: e.size ?? 0 }))
}

async function downloadIfMissing({ path, size }) {
  const dest = join(OUT_DIR, path)
  if (existsSync(dest)) {
    try {
      const s = await stat(dest)
      if (size === 0 || s.size === size) {
        process.stdout.write(`  ok    ${path}\n`)
        return
      }
    } catch {
      // fall through and re-download
    }
  }

  process.stdout.write(`  fetch ${path} (${(size / 1e6).toFixed(1)} MB)\n`)
  await mkdir(dirname(dest), { recursive: true })

  const res = await fetch(HF_RESOLVE(path))
  if (!res.ok) {
    throw new Error(`Failed to download ${path}: ${res.status} ${res.statusText}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const tmp = `${dest}.part`
  await writeFile(tmp, buf)
  await rename(tmp, dest)
}

async function main() {
  process.stdout.write(`Kokoro model → ${OUT_DIR}\n`)
  await mkdir(OUT_DIR, { recursive: true })

  const files = await listRepoFiles()
  // Skip files we do not need at runtime (e.g. large fp16 variants only
  // consumed on WebGPU; keep them anyway since bundling once is easier).
  for (const file of files) {
    await downloadIfMissing(file)
  }
  process.stdout.write(`done: ${files.length} files\n`)
}

main().catch((err) => {
  process.stderr.write(`download-models.mjs failed: ${err.message}\n`)
  process.exit(1)
})
