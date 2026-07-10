import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  alignWithGentleBytes,
  GENTLE_ALIGN_MAX_BYTES,
  gentleUrl,
  isGentleAvailable,
} from '@/server/alignment/gentle'

export const Route = createFileRoute('/api/align')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const available = await isGentleAvailable()
        if (!available) {
          return json({ detail: 'Gentle alignment is not available' }, { status: 503 })
        }

        const baseUrl = gentleUrl()
        if (!baseUrl) {
          return json({ detail: 'Gentle alignment is not configured' }, { status: 503 })
        }

        let form: FormData
        try {
          form = await request.formData()
        } catch {
          return json({ detail: 'Expected multipart form data' }, { status: 400 })
        }

        const audio = form.get('audio')
        const transcriptValue = form.get('transcript')
        const transcript = typeof transcriptValue === 'string' ? transcriptValue.trim() : ''

        if (!(audio instanceof Blob)) {
          return json({ detail: 'audio field is required' }, { status: 400 })
        }
        if (!transcript) {
          return json({ detail: 'transcript is required' }, { status: 400 })
        }
        if (audio.size > GENTLE_ALIGN_MAX_BYTES) {
          return json({ detail: 'Audio clip is too large' }, { status: 413 })
        }

        try {
          const buffer = new Uint8Array(await audio.arrayBuffer())
          const words = await alignWithGentleBytes(buffer, transcript, baseUrl)
          return json({ words })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Alignment failed'
          return json({ detail: message }, { status: 500 })
        }
      },
    },
  },
})
