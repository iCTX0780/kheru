import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Toaster } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { StudioShell } from '@/components/studio/StudioShell'
import { KeyboardShortcutsDialog } from '@/components/studio/KeyboardShortcutsDialog'
import { useStudioHydration } from '@/hooks/use-studio-hydration'
import { useStudioActions } from '@/hooks/use-studio-actions'
import { useStudioStore } from '@/stores/studio'
import { useVoices } from '@/lib/api'
import { DEFAULT_VOICE_ID } from '@/lib/voice-catalog'
import { playableParagraphs } from '@/lib/playback-segments'

export const Route = createFileRoute('/')({
  component: StudioPage,
})

function StudioPage() {
  const hydrated = useStudioHydration()
  const { data: voiceList = [], isLoading: isLoadingVoices } = useVoices()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const setVoices = useStudioStore((s) => s.setVoices)
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const chapter = useStudioStore((s) => s.chapter)
  const playback = useStudioStore((s) => s.playback)

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
        togglePlayPause()
      }
      if (event.key === '?') {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlayPause])

  const hasText = paragraphs.some((p) => p.text.trim())
  const canPlay =
    (chapter.status === 'done' && !!chapter.audioUrl) || playableParagraphs(paragraphs).length > 0

  return (
    <>
      <StudioShell
        hydrated={hydrated}
        voices={voiceList}
        isLoadingVoices={isLoadingVoices}
        chapterGenerating={chapter.status === 'generating'}
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

      {chapter.error && (
        <div className="border-t border-destructive/20 bg-destructive/10 px-6 py-3">
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{chapter.error}</AlertDescription>
          </Alert>
        </div>
      )}

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Toaster position="bottom-right" />
    </>
  )
}
