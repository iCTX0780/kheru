import { createFileRoute } from '@tanstack/react-router'
import { exportConcat, type ExportFormat } from '@/server/tts/export'

export const Route = createFileRoute('/api/export')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { run_ids?: string[]; format?: ExportFormat }
        try {
          body = await request.json()
        } catch {
          return new Response(JSON.stringify({ detail: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const runIds = body.run_ids
        const format = body.format ?? 'wav'

        if (!Array.isArray(runIds) || runIds.length === 0) {
          return new Response(JSON.stringify({ detail: 'run_ids must be a non-empty array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (format !== 'wav' && format !== 'mp3') {
          return new Response(JSON.stringify({ detail: 'format must be wav or mp3' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        try {
          const result = exportConcat(runIds, format)
          return new Response(result.buffer, {
            headers: {
              'Content-Type': result.contentType,
              'Content-Disposition': `attachment; filename="${result.filename}"`,
              'Content-Length': String(result.buffer.length),
            },
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Export failed'
          const status =
            message.startsWith('Invalid run id') ||
            message.startsWith('Audio not found') ||
            message.startsWith('No audio clips')
              ? 400
              : message.startsWith('MP3 export requires ffmpeg')
                ? 501
                : 500
          return new Response(JSON.stringify({ detail: message }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
