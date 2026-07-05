import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { listVoiceCatalog } from '@/server/voices/catalog'

export const Route = createFileRoute('/api/voices')({
  server: {
    handlers: {
      GET: () => json({ voices: listVoiceCatalog() }),
    },
  },
})
