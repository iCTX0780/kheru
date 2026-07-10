/**
 * Browser Kokoro spike reference — run the in-app benchmark at /kokoro-spike instead.
 * This script documents the expected metrics table for go/no-go decisions.
 */
console.log(`
Kheru client TTS spike
====================
Open the dev server and visit /kokoro-spike to benchmark WebGPU vs WASM.

Record:
| Metric              | WebGPU + fp32 | WASM + q8 |
|---------------------|---------------|-----------|
| Model load (cold)   |               |           |
| Model load (warm)   |               |           |
| ~15-word paragraph  |               |           |
| ~100-word paragraph |               |           |

Pass: warm gen < 8s per typical paragraph on target device.
`)
