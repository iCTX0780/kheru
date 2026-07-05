import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { jsonStore } from '@/server/db/json-store'
import { generateConversation } from '@/server/tts'

interface TurnBody {
  speaker: string
  voice: string
  text: string
  length_scale?: number
  gap_after?: number
}

export const Route = createFileRoute('/api/generate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { conversation?: TurnBody[] }
        try {
          body = await request.json()
        } catch {
          return json({ detail: 'Invalid JSON body' }, { status: 400 })
        }

        const conversation = body.conversation
        if (!Array.isArray(conversation) || conversation.length === 0) {
          return json({ detail: 'conversation must be a non-empty array' }, { status: 400 })
        }

        try {
          const { runId, segments, words, clips } = await generateConversation(conversation)
          jsonStore.appendGeneration({ runId })
          return json({
            run_id: runId,
            audio_url: `/api/audio/${runId}`,
            segments,
            words,
            clips,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Generation failed'
          const status = message.startsWith('Unknown voice') ? 400 : 500
          return json({ detail: message }, { status })
        }
      },
    },
  },
})
