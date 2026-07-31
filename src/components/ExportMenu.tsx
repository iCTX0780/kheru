import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Download, FileAudio, FolderArchive, Package } from 'lucide-react'
import { toast } from 'sonner'
import {
  canExportFullMix,
  canExportParagraphs,
  exportFullMix,
  exportParagraphsZip,
} from '@/lib/export'
import { canExportPlaypack, exportPlaypack } from '@/lib/export-playpack'
import { useStudioStore } from '@/stores/studio'

type ExportAction = 'full-mix-wav' | 'paragraphs-zip' | 'playpack-kheru'

export function ExportMenu() {
  const [busyAction, setBusyAction] = useState<ExportAction | null>(null)

  const paragraphs = useStudioStore((s) => s.paragraphs)
  const chapter = useStudioStore((s) => s.chapter)
  const projectTitle = useStudioStore((s) => s.projectTitle)
  const chapterTitle = useStudioStore((s) => s.chapterTitle)

  const fullMixReady = canExportFullMix(paragraphs, chapter)
  const paragraphsReady = canExportParagraphs(paragraphs)
  const playpackReady = canExportPlaypack(paragraphs, chapter)
  const hasAnyExport = fullMixReady || paragraphsReady || playpackReady

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
          <DropdownMenuItem
            disabled={!playpackReady || busyAction !== null}
            onClick={() =>
              void runExport('playpack-kheru', () =>
                exportPlaypack(paragraphs, chapter, projectTitle, chapterTitle)
              )
            }
          >
            {busyAction === 'playpack-kheru' ? <Spinner /> : <Package />}
            Playpack (.kheru)
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
