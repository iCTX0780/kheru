import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { stitchRunIds } from '@/server/tts/export'

export const Route = createFileRoute('/api/stitch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { run_ids?: string[] }
        try {
          body = await request.json()
        } catch {
          return json({ detail: 'Invalid JSON body' }, { status: 400 })
        }

        const runIds = body.run_ids
        if (!Array.isArray(runIds) || runIds.length === 0) {
          return json({ detail: 'run_ids must be a non-empty array' }, { status: 400 })
        }

        try {
          const result = stitchRunIds(runIds)
          return json(result)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Stitch failed'
          const status =
            message.startsWith('Invalid run id') ||
            message.startsWith('Audio not found') ||
            message.startsWith('No audio clips')
              ? 400
              : 500
          return json({ detail: message }, { status })
        }
      },
    },
  },
})
