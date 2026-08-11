#!/usr/bin/env node
// Phoneme-dump harness that reproduces kokoro-js's exact normalize +
// phonemize pipeline WITHOUT loading the ONNX model. Kokoro-js's model
// loader (via @huggingface/transformers) is flaky for one-shot Node use
// (cache corruption / download issues), and we only care about the
// phoneme string here — kokoro-js's `m(text, voice.at(0))` function is
// the whole thing we need.
//
// Companion to `src-tauri/tests/misaki_spike.rs`. Copies kokoro-js's
// normalize+phonemize chain verbatim from `dist/kokoro.js` (function `m`)
// and calls the same `phonemizer` npm package it uses under the hood.
// Output matches what browser kokoro-js would send to the Kokoro model
// after the normalize/phonemize stage.
//
// Usage: node scripts/dump-kokoro-js-phonemes.mjs [--dialect en-us|en-gb]
// Output: JSON to stdout.

// `phonemizer` is a transitive dep of kokoro-js — import via the pnpm-managed
// path so this script doesn't need its own top-level dep.
import { phonemize } from '../node_modules/.pnpm/phonemizer@1.2.1/node_modules/phonemizer/dist/phonemizer.js'

const SAMPLES = [
  'Hello, world.',
  'The quick brown fox jumps over the lazy dog.',
  "I said, \"Don't do that.\"",
  'She read the letter, then read it again — the same words, a different meaning.',
  'On May 5, 1990, at 3:15 PM, the temperature was 72.5 degrees.',
  'Dr. Smith and Mrs. Jones bought $250.50 worth of etc.',
  'The F.B.I. arrived at 9:00 AM to investigate.',
  'This costs $1,234.56 but the sale price is $999.',
  'The 1990s were a wild decade — from grunge to Y2K.',
  'Object as a noun means a thing; to object as a verb means to protest.',
]

// ---- kokoro-js normalize + phonemize, copied verbatim from
//      node_modules/kokoro-js/dist/kokoro.js function `m` ----

function timeYearDecimal(e) {
  if (e.includes('.')) return e
  if (e.includes(':')) {
    const [a, t] = e.split(':').map(Number)
    return t === 0 ? `${a} o'clock` : t < 10 ? `${a} oh ${t}` : `${a} ${t}`
  }
  const a = parseInt(e.slice(0, 4), 10)
  if (a < 1100 || a % 1e3 < 10) return e
  const t = e.slice(0, 2)
  const r = parseInt(e.slice(2, 4), 10)
  const n = e.endsWith('s') ? 's' : ''
  if (a % 1e3 >= 100 && a % 1e3 <= 999) {
    if (r === 0) return `${t} hundred${n}`
    if (r < 10) return `${t} oh ${r}${n}`
  }
  return `${t} ${r}${n}`
}

function currency(e) {
  const a = e[0] === '$' ? 'dollar' : 'pound'
  if (isNaN(Number(e.slice(1)))) return `${e.slice(1)} ${a}s`
  if (!e.includes('.')) {
    const t = e.slice(1) === '1' ? '' : 's'
    return `${e.slice(1)} ${a}${t}`
  }
  const [t, r] = e.slice(1).split('.')
  const n = parseInt(r.padEnd(2, '0'), 10)
  return `${t} ${a}${t === '1' ? '' : 's'} and ${n} ${
    e[0] === '$' ? (n === 1 ? 'cent' : 'cents') : n === 1 ? 'penny' : 'pence'
  }`
}

function decimal(e) {
  const [a, t] = e.split('.')
  return `${a} point ${t.split('').join(' ')}`
}

// Punctuation splitting regex (verbatim from kokoro-js line 1):
// splits on runs of `;:,.!?¡¿—…"«»""()[]{}`',`
const PUNCT_CHARS = `;:,.!?¡¿—…"«»“”(){}[]',`
const PUNCT_RE = new RegExp(
  `(\\s*[${PUNCT_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+\\s*)+`,
  'g'
)

function normalize(e) {
  return e
    .replace(/[‘’]/g, "'")
    .replace(/«/g, '“')
    .replace(/»/g, '”')
    .replace(/[“”]/g, '"')
    .replace(/\(/g, '«')
    .replace(/\)/g, '»')
    .replace(/、/g, ', ')
    .replace(/。/g, '. ')
    .replace(/！/g, '! ')
    .replace(/，/g, ', ')
    .replace(/：/g, ': ')
    .replace(/；/g, '; ')
    .replace(/？/g, '? ')
    .replace(/[^\S \n]/g, ' ')
    .replace(/  +/, ' ')
    .replace(/(?<=\n) +(?=\n)/g, '')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor')
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister')
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss')
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc')
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, timeYearDecimal)
    .replace(/(?<=\d),(?=\d)/g, '')
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, currency)
    .replace(/\d*\.\d+/g, decimal)
    .replace(/(?<=\d)-(?=\d)/g, ' to ')
    .replace(/(?<=\d)S/g, ' S')
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, 's')
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (s) => s.replace(/\./g, '-'))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, '-')
    .trim()
}

function splitByPunctuation(input, re) {
  const parts = []
  let last = 0
  for (const m of input.matchAll(re)) {
    const s = m[0]
    if (last < m.index) parts.push({ match: false, text: input.slice(last, m.index) })
    if (s.length > 0) parts.push({ match: true, text: s })
    last = m.index + s.length
  }
  if (last < input.length) parts.push({ match: false, text: input.slice(last) })
  return parts
}

async function kokoroJsPhonemize(text, dialect) {
  const normalized = normalize(text)
  const parts = splitByPunctuation(normalized, PUNCT_RE)
  const lang = dialect === 'en-gb' ? 'en' : 'en-us'
  const phonemized = (
    await Promise.all(
      parts.map(async ({ match, text }) =>
        match ? text : (await phonemize(text, lang)).join(' ')
      )
    )
  ).join('')
  // Kokoro post-processing (from kokoro-js source):
  let out = phonemized
    .replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ')
    .replace(/kəkˈɔːɹəʊ/g, 'kˈəʊkəɹəʊ')
    .replace(/ʲ/g, 'j')
    .replace(/r/g, 'ɹ')
    .replace(/x/g, 'k')
    .replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ')
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z')
  if (dialect !== 'en-gb') {
    out = out.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di')
  }
  return out.trim()
}

async function main() {
  const args = process.argv.slice(2)
  const dialectIdx = args.indexOf('--dialect')
  const dialect = dialectIdx >= 0 ? args[dialectIdx + 1] : 'en-us'

  process.stderr.write(`Phonemizing ${SAMPLES.length} samples (${dialect}) …\n`)
  const out = { dialect, samples: [] }
  for (const text of SAMPLES) {
    const phonemes = await kokoroJsPhonemize(text, dialect)
    out.samples.push({ text, phonemes })
    process.stderr.write(`  ✓ ${text.slice(0, 40)}${text.length > 40 ? '…' : ''}\n`)
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n')
}

main().catch((err) => {
  process.stderr.write(`FAIL: ${err.stack || err.message}\n`)
  process.exit(1)
})
