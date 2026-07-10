import { createFileRoute } from '@tanstack/react-router'
import { wavHeadResponse, wavResponse } from '@/server/audio/stream'
import { audioPath } from '@/server/tts/paths'

export const Route = createFileRoute('/api/audio/$runId')({
  server: {
    handlers: {
      HEAD: ({ params }) => {
        const runId = params.runId
        if (!/^[0-9a-f]{8}$/.test(runId)) {
          return new Response(JSON.stringify({ detail: 'Invalid run id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const result = wavHeadResponse(audioPath(runId))
        if ('error' in result) return result.error
        return result
      },
      GET: ({ params, request }) => {
        const runId = params.runId
        if (!/^[0-9a-f]{8}$/.test(runId)) {
          return new Response(JSON.stringify({ detail: 'Invalid run id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const result = wavResponse(audioPath(runId), request)
        if ('error' in result) return result.error
        return result
      },
    },
  },
})
