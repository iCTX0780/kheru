import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isClientTtsEnabled } from '@/lib/client-tts/config'
import { isGentleAvailable } from '@/server/alignment/gentle'

export const Route = createFileRoute('/api/capabilities')({
  server: {
    handlers: {
      GET: async () => {
        const gentle = await isGentleAvailable()
        return json({
          gentle,
          client_tts_build: isClientTtsEnabled(),
        })
      },
    },
  },
})
