import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { existsSync } from 'node:fs'
import { readWavPcmSamples } from '@/server/audio/stream'
import { computePeakMeta, getCachedPeaks, setCachedPeaks } from '@/server/audio/peaks-cache'
import { audioPath, TARGET_SAMPLE_RATE } from '@/server/tts/paths'

export const Route = createFileRoute('/api/audio/$runId/peaks')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const runId = params.runId
        if (!/^[0-9a-f]{8}$/.test(runId)) {
          return json({ detail: 'Invalid run id' }, { status: 400 })
        }

        const cached = getCachedPeaks(runId)
        if (cached) {
          return json(cached)
        }

        const path = audioPath(runId)
        if (!existsSync(path)) {
          return json({ detail: 'Audio not found' }, { status: 404 })
        }

        const samples = readWavPcmSamples(path, 1000)
        const { duration, maxAmplitude } = computePeakMeta(samples, TARGET_SAMPLE_RATE)
        const payload = { samples, duration, maxAmplitude }
        setCachedPeaks(runId, payload)
        return json(payload)
      },
    },
  },
})
