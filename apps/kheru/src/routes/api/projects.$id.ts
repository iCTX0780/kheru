import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { jsonStore } from '@/server/db/json-store'

export const Route = createFileRoute('/api/projects/$id')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const project = jsonStore.getProject(params.id)
        if (!project) return json({ detail: 'Project not found' }, { status: 404 })
        return json(project)
      },
      PUT: async ({ params, request }) => {
        let body: {
          title?: string
          chapters?: unknown[]
          activeChapterId?: string
          updatedAt?: string
        }
        try {
          body = await request.json()
        } catch {
          return json({ detail: 'Invalid JSON body' }, { status: 400 })
        }

        const existing = jsonStore.getProject(params.id)
        const project = jsonStore.upsertProject({
          id: params.id,
          title: body.title?.trim() || existing?.title || 'Untitled project',
          chapters: body.chapters ?? existing?.chapters ?? [],
          activeChapterId: body.activeChapterId ?? existing?.activeChapterId ?? '',
          updatedAt: body.updatedAt ?? new Date().toISOString(),
        })
        return json(project)
      },
      DELETE: ({ params }) => {
        const deleted = jsonStore.deleteProject(params.id)
        if (!deleted) return json({ detail: 'Project not found' }, { status: 404 })
        return json({ ok: true })
      },
    },
  },
})
