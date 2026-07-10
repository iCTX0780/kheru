import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { jsonStore } from '@/server/db/json-store'

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: () => {
        return json(jsonStore.listProjects())
      },
      POST: async ({ request }) => {
        let body: {
          id?: string
          title?: string
          chapters?: unknown[]
          activeChapterId?: string
        }
        try {
          body = await request.json()
        } catch {
          return json({ detail: 'Invalid JSON body' }, { status: 400 })
        }

        if (!body.title?.trim()) {
          return json({ detail: 'title is required' }, { status: 400 })
        }

        const id = body.id ?? crypto.randomUUID()
        const project = jsonStore.upsertProject({
          id,
          title: body.title.trim(),
          chapters: body.chapters ?? [],
          activeChapterId: body.activeChapterId ?? '',
          updatedAt: new Date().toISOString(),
        })
        return json(project, { status: 201 })
      },
    },
  },
})
