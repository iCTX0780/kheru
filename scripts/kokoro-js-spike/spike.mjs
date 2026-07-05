/**
 * Validation spike: kokoro-js on Node (Kheru server TTS path).
 * Compare output to legacy kokoro-onnx via voice-bakeoff samples.
 */
import { mkdirSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { KokoroTTS } from 'kokoro-js'

const SAMPLE_TEXT =
  'Thanks for making the time. I wanted to walk through some important ideas with you.'

const VOICE = 'am_michael'
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../../voice-bakeoff')
const outPath = resolve(outDir, `kokoro-js-${VOICE}-spike.wav`)
const onnxBaseline = resolve(outDir, `kokoro-${VOICE}.wav`)

mkdirSync(outDir, { recursive: true })

console.log('Loading KokoroTTS (first run may download model)...')
const loadStart = performance.now()
const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
  dtype: 'q8',
  device: 'cpu',
})
const loadMs = Math.round(performance.now() - loadStart)

const voices = tts.list_voices?.() ?? []
console.log(`Model loaded in ${loadMs}ms`)
console.log(`Voices available: ${Array.isArray(voices) ? voices.length : 'unknown'}`)
if (Array.isArray(voices) && !voices.includes(VOICE)) {
  console.warn(`Warning: ${VOICE} not in list_voices(); trying anyway`)
}

console.log(`Generating: "${SAMPLE_TEXT.slice(0, 50)}..."`)
const genStart = performance.now()
const audio = await tts.generate(SAMPLE_TEXT, { voice: VOICE })
const genMs = Math.round(performance.now() - genStart)

await audio.save(outPath)

const meta = {
  voice: VOICE,
  model: MODEL_ID,
  device: 'cpu',
  dtype: 'q8',
  loadMs,
  genMs,
  outPath,
  sampleRate: audio.sample_rate ?? audio.sampling_rate ?? 'unknown',
  durationSec: audio.duration ?? 'unknown',
  onnxBaselineExists: false,
}

try {
  const { accessSync } = await import('node:fs')
  accessSync(onnxBaseline)
  meta.onnxBaselineExists = true
  meta.onnxBaselinePath = onnxBaseline
} catch {
  meta.onnxBaselineNote = 'Run `make voice-bakeoff` for side-by-side WAV comparison'
}

console.log('\n--- Spike result ---')
console.log(JSON.stringify(meta, null, 2))
console.log(`\nListen: ${outPath}`)
