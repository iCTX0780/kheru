import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Download, FileAudio, FileText, FolderArchive } from 'lucide-react'
import { toast } from 'sonner'
import {
  canExportFullMix,
  canExportParagraphs,
  canExportSubtitles,
  exportFullMix,
  exportParagraphsZip,
  exportSubtitles,
} from '@/lib/export'
import { useStudioStore } from '@/stores/studio'

type ExportAction =
  | 'full-mix-wav'
  | 'full-mix-mp3'
  | 'paragraphs-zip'
  | 'subtitles-srt'
  | 'subtitles-vtt'
  | 'subtitles-words-srt'
  | 'subtitles-words-vtt'

export function ExportMenu() {
  const [busyAction, setBusyAction] = useState<ExportAction | null>(null)

  const paragraphs = useStudioStore((s) => s.paragraphs)
  const chapter = useStudioStore((s) => s.chapter)
  const projectTitle = useStudioStore((s) => s.projectTitle)
  const chapterTitle = useStudioStore((s) => s.chapterTitle)

  const fullMixReady = canExportFullMix(paragraphs, chapter)
  const paragraphsReady = canExportParagraphs(paragraphs)
  const subtitlesReady = canExportSubtitles(paragraphs, chapter)
  const hasAnyExport = fullMixReady || paragraphsReady || subtitlesReady

  const runExport = useCallback(
    async (action: ExportAction, task: () => void | Promise<void>) => {
      setBusyAction(action)
      try {
        await task()
        toast.success('Export complete')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Export failed'
        toast.error(message)
      } finally {
        setBusyAction(null)
      }
    },
    []
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={!hasAnyExport || busyAction !== null}
          />
        }
      >
        {busyAction ? (
          <>
            <Spinner data-icon="inline-start" />
            Exporting...
          </>
        ) : (
          <>
            <Download data-icon="inline-start" />
            Export
            <ChevronDown />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={!fullMixReady || busyAction !== null}
            onClick={() =>
              void runExport('full-mix-wav', () =>
                exportFullMix(paragraphs, chapter, 'wav', projectTitle, chapterTitle)
              )
            }
          >
            {busyAction === 'full-mix-wav' ? <Spinner /> : <FileAudio />}
            Full mix (WAV)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!fullMixReady || busyAction !== null}
            onClick={() =>
              void runExport('full-mix-mp3', () =>
                exportFullMix(paragraphs, chapter, 'mp3', projectTitle, chapterTitle)
              )
            }
          >
            {busyAction === 'full-mix-mp3' ? <Spinner /> : <FileAudio />}
            Full mix (MP3)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!paragraphsReady || busyAction !== null}
            onClick={() =>
              void runExport('paragraphs-zip', () =>
                exportParagraphsZip(paragraphs, projectTitle, chapterTitle)
              )
            }
          >
            {busyAction === 'paragraphs-zip' ? <Spinner /> : <FolderArchive />}
            Paragraph audio (ZIP)
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Subtitles</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!subtitlesReady || busyAction !== null}
            onClick={() =>
              void runExport('subtitles-srt', () =>
                exportSubtitles(paragraphs, chapter, 'srt', 'paragraph', projectTitle, chapterTitle)
              )
            }
          >
            {busyAction === 'subtitles-srt' ? <Spinner /> : <FileText />}
            Paragraphs (SRT)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!subtitlesReady || busyAction !== null}
            onClick={() =>
              void runExport('subtitles-vtt', () =>
                exportSubtitles(paragraphs, chapter, 'vtt', 'paragraph', projectTitle, chapterTitle)
              )
            }
          >
            {busyAction === 'subtitles-vtt' ? <Spinner /> : <FileText />}
            Paragraphs (VTT)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!subtitlesReady || busyAction !== null}
            onClick={() =>
              void runExport('subtitles-words-srt', () =>
                exportSubtitles(paragraphs, chapter, 'srt', 'word', projectTitle, chapterTitle)
              )
            }
          >
            {busyAction === 'subtitles-words-srt' ? <Spinner /> : <FileText />}
            Words (SRT)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!subtitlesReady || busyAction !== null}
            onClick={() =>
              void runExport('subtitles-words-vtt', () =>
                exportSubtitles(paragraphs, chapter, 'vtt', 'word', projectTitle, chapterTitle)
              )
            }
          >
            {busyAction === 'subtitles-words-vtt' ? <Spinner /> : <FileText />}
            Words (VTT)
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
