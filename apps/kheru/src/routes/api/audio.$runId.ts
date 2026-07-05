import { createFileRoute } from '@tanstack/react-router'
import { readFileSync, existsSync } from 'node:fs'
import { audioPath } from '@/server/tts/paths'

export const Route = createFileRoute('/api/audio/$runId')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const runId = params.runId
        if (!/^[0-9a-f]{8}$/.test(runId)) {
          return new Response(JSON.stringify({ detail: 'Invalid run id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const path = audioPath(runId)
        if (!existsSync(path)) {
          return new Response(JSON.stringify({ detail: 'Audio not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const buf = readFileSync(path)
        return new Response(buf, {
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': String(buf.length),
          },
        })
      },
    },
  },
})
