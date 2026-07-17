import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { voiceDotClass } from '@/lib/voice-colors'
import type { ProjectSummary } from '@/lib/project-db'
import { cn } from '@/lib/utils'
import { MoreHorizontal } from 'lucide-react'

interface ProjectCardProps {
  project: ProjectSummary
  onDelete: (id: string) => void
  onRename: (id: string) => void
}

export const ProjectCard = memo(function ProjectCard({
  project,
  onDelete,
  onRename,
}: ProjectCardProps) {
  const status =
    project.paragraphCount === 0
      ? 'empty'
      : project.doneCount === project.paragraphCount
        ? 'ready'
        : project.doneCount > 0
          ? 'partial'
          : 'draft'

  const statusLabel =
    status === 'ready' ? 'Generated' : status === 'partial' ? 'In progress' : status === 'empty' ? 'Empty' : 'Draft'

  return (
    <Card
      className="group relative overflow-hidden border-border/80 bg-surface/80 transition-colors hover:border-primary/30 [content-visibility:auto]"
      style={{ animationDelay: `${Math.min(project.title.length, 20) * 20}ms` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.04),transparent_55%)]" />
      <CardHeader className="relative gap-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-heading text-lg leading-tight">{project.title}</CardTitle>
          <Badge variant={status === 'ready' ? 'default' : 'secondary'}>{statusLabel}</Badge>
        </div>
        <CardDescription className="font-mono text-[0.65rem]">
          {project.paragraphCount} ¶ · {new Date(project.updatedAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex items-center gap-1.5" aria-hidden>
          {project.voices.length > 0 ? (
            project.voices.map((voiceId) => (
              <span
                key={voiceId}
                className={cn('size-2 rounded-full', voiceDotClass(voiceId, project.voices))}
              />
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No voices yet</span>
          )}
        </div>
      </CardContent>
      <CardFooter className="relative flex items-center justify-between gap-2">
        <Button
          nativeButton={false}
          size="sm"
          render={<Link to="/studio/$projectId" params={{ projectId: project.id }} preload="intent" />}
        >
          Open
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Project actions" />}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onRename(project.id)}>Rename</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(project.id)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  )
})
