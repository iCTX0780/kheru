import { createFileRoute } from '@tanstack/react-router'
import { existsSync } from 'node:fs'
import {
  getOrCreateVoicePreview,
  readVoicePreviewWav,
  voiceIdFromSlug,
  voicePreviewPath,
} from '@/server/tts/voice-preview'

export const Route = createFileRoute('/api/voice-preview/$slug')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.slug
        if (!/^[a-z]+_[a-z0-9_]+$/.test(slug)) {
          return new Response(JSON.stringify({ detail: 'Invalid voice slug' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const voiceId = voiceIdFromSlug(slug)
        if (!voiceId) {
          return new Response(JSON.stringify({ detail: 'Invalid voice slug' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        try {
          const path = existsSync(voicePreviewPath(voiceId))
            ? voicePreviewPath(voiceId)
            : await getOrCreateVoicePreview(voiceId)
          const buf = readVoicePreviewWav(path)
          return new Response(new Uint8Array(buf), {
            headers: {
              'Content-Type': 'audio/wav',
              'Content-Length': String(buf.length),
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Voice preview failed'
          const status = message.startsWith('Unknown voice') ? 400 : 500
          return new Response(JSON.stringify({ detail: message }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
