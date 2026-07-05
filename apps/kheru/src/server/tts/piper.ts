import { spawn } from 'node:child_process'
import { accessSync } from 'node:fs'
import { resolve } from 'node:path'
import { VOICES_DIR } from './paths'

export async function synthPiper(
  text: string,
  voiceKey: string,
  outPath: string,
  lengthScale: number
): Promise<void> {
  const model = resolve(VOICES_DIR, `${voiceKey}.onnx`)
  try {
    accessSync(model)
  } catch {
    throw new Error(`Piper model not found: ${voiceKey}`)
  }

  await new Promise<void>((resolvePromise, reject) => {
    const proc = spawn(
      'piper',
      ['--model', model, '--output_file', outPath, '--length_scale', String(lengthScale)],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`Piper failed: ${stderr || `exit ${code}`}`))
    })
    proc.stdin.write(text)
    proc.stdin.end()
  })
}
