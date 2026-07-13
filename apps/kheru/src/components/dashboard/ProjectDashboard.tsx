import { startTransition, useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { DEFAULT_VOICE_ID } from '@/lib/voice-catalog'
import {
  createDefaultProject,
  deleteProjectFromIDB,
  listProjectsFromIDB,
  projectSummary,
  saveProjectToIDB,
  setMetaValue,
  type ProjectSummary,
} from '@/lib/project-db'

export function ProjectDashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const refreshProjects = useCallback(async () => {
    const idbProjects = await listProjectsFromIDB()
    const summaries = idbProjects
      .map(projectSummary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    setProjects(summaries)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshProjects()
  }, [refreshProjects])

  const handleCreate = async () => {
    const title = newTitle.trim() || 'Untitled project'
    const project = createDefaultProject(DEFAULT_VOICE_ID, title)
    await saveProjectToIDB(project)
    await setMetaValue('lastActiveProjectId', project.id)
    setCreateOpen(false)
    setNewTitle('')
    startTransition(() => {
      void navigate({ to: '/studio/$projectId', params: { projectId: project.id } })
    })
  }

  const handleRename = async () => {
    if (!renameId) return
    const title = renameTitle.trim()
    if (!title) return
    const record = (await listProjectsFromIDB()).find((p) => p.id === renameId)
    if (!record) return
    const updated = { ...record, title }
    await saveProjectToIDB(updated)
    setRenameId(null)
    toast.success('Project renamed')
    void refreshProjects()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    setDeleteId(null)

    setProjects((prev) => prev.filter((p) => p.id !== id))
    await deleteProjectFromIDB(id)
    toast.success('Project deleted')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="relative border-b border-border bg-background">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                Kheru<span className="font-normal text-muted-foreground"> Studio</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Open a script, assign speakers, and pick up where you left off.
              </p>
            </div>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              New project
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Empty className="border border-dashed border-border bg-surface/40">
            <EmptyHeader>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>Import a script and start rehearsing.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus data-icon="inline-start" />
                Create your first project
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRename={(id) => {
                  setRenameId(id)
                  setRenameTitle(project.title)
                }}
                onDelete={setDeleteId}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-project-title">Project title</FieldLabel>
              <Input
                id="new-project-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Untitled project"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreate()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameId !== null} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rename-project-title">Project title</FieldLabel>
              <Input
                id="rename-project-title"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleRename()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project and its audio from this browser. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
