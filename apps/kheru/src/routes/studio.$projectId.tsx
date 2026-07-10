import { createFileRoute, redirect } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { KeyboardShortcutsDialog } from '@/components/studio/KeyboardShortcutsDialog'
import { useStudioHydration, useProjectAutoSave } from '@/hooks/use-studio-hydration'
import { useStudioActions } from '@/hooks/use-studio-actions'
import { useStudioStore } from '@/stores/studio'
import { useVoices } from '@/lib/api'
import { DEFAULT_VOICE_ID } from '@/lib/voice-catalog'
import { playableParagraphs } from '@/lib/playback-segments'
import { getProjectFromIDB } from '@/lib/project-db'

const StudioShell = lazy(() =>
  import('@/components/studio/StudioShell').then((m) => ({ default: m.StudioShell }))
)

export const Route = createFileRoute('/studio/$projectId')({
  beforeLoad: async ({ params }) => {
    if (typeof window === 'undefined') return
    const project = await getProjectFromIDB(params.projectId)
    if (!project) {
      throw redirect({ to: '/' })
    }
  },
  component: StudioPage,
})

function StudioPage() {
  const { projectId } = Route.useParams()
  const hydrated = useStudioHydration(projectId)
  useProjectAutoSave(hydrated)
  const { data: voiceList = [], isLoading: isLoadingVoices } = useVoices()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const setVoices = useStudioStore((s) => s.setVoices)
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const chapter = useStudioStore((s) => s.chapter)
  const playback = useStudioStore((s) => s.playback)
  const generationLocked = useStudioStore(
    (s) => s.generationSession.active || s.chapter.status === 'generating'
  )

  const {
    handleGenerateChapter,
    handleGenerateSelection,
    handlePlayParagraph,
    handlePlaySelection,
    handlePlayAll,
    togglePlayPause,
  } = useStudioActions()

  useEffect(() => {
    if (!hydrated || voiceList.length === 0) return

    const ids = voiceList.map((v) => v.id)
    const preferred = ids.includes(DEFAULT_VOICE_ID) ? DEFAULT_VOICE_ID : ids[0]
    setVoices(ids, preferred)
  }, [hydrated, voiceList, setVoices])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        if (event.key === '?') {
          event.preventDefault()
          setShortcutsOpen(true)
        }
        return
      }

      if (event.key === ' ') {
        event.preventDefault()
        if (!generationLocked) togglePlayPause()
      }
      if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [generationLocked, togglePlayPause])

  const hasText = paragraphs.some((p) => p.text.trim())
  const canPlay =
    !generationLocked &&
    ((chapter.status === 'done' && !!chapter.audioUrl) || playableParagraphs(paragraphs).length > 0)

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense
          fallback={
            <div className="flex flex-1 flex-col gap-3 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="min-h-0 flex-1" />
            </div>
          }
        >
          <StudioShell
            hydrated={hydrated}
            voices={voiceList}
            isLoadingVoices={isLoadingVoices}
            chapterGenerating={chapter.status === 'generating'}
            chapterError={chapter.error}
            hasText={hasText}
            canPlay={canPlay}
            isPlaying={playback.isPlaying}
            onTogglePlay={togglePlayPause}
            onGenerateSelection={() => void handleGenerateSelection()}
            onGenerateChapter={() => void handleGenerateChapter()}
            onPlayParagraph={handlePlayParagraph}
            onPlayAll={handlePlayAll}
            onPlaySelection={handlePlaySelection}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
        </Suspense>
      </div>

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Toaster position="bottom-right" />
    </>
  )
}
