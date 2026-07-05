import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FieldLabel } from '@/components/ui/field'
import { ParagraphBlock } from '@/components/ParagraphBlock'
import { parseImportScript } from '@/lib/parse-script'
import { useStudioStore } from '@/stores/studio'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'

import type { VoiceInfo } from '@/lib/api'

interface ParagraphTimelineProps {
  voices: VoiceInfo[]
  onPlayParagraph: (id: string) => void
}

export function ParagraphTimeline({ voices, onPlayParagraph }: ParagraphTimelineProps) {
  const paragraphs = useStudioStore((s) => s.paragraphs)
  const addParagraph = useStudioStore((s) => s.addParagraph)
  const importParagraphs = useStudioStore((s) => s.importParagraphs)
  const playback = useStudioStore((s) => s.playback)

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const handleImport = () => {
    const texts = parseImportScript(importText)
    if (texts.length === 0) return
    importParagraphs(texts)
    setImportText('')
    setImportOpen(false)
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Paragraphs
        </FieldLabel>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={() => setImportOpen((o) => !o)}
        >
          {importOpen ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
          Import script
        </Button>
      </div>

      {importOpen && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Paste lines in Speaker: dialogue format — speaker names are ignored.
          </p>
          <Textarea
            value={importText}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setImportText(e.target.value)}
            placeholder={'Shadi: Happy to make the time...\nInterviewer: What interests you?'}
            className="min-h-24 text-sm font-mono"
          />
          <Button type="button" size="sm" className="self-start" onClick={handleImport} disabled={!importText.trim()}>
            Import
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
        {paragraphs.map((paragraph, index) => (
          <ParagraphBlock
            key={paragraph.id}
            paragraph={paragraph}
            index={index}
            voices={voices}
            isActive={playback.activeParagraphId === paragraph.id}
            isPlaying={playback.isPlaying && playback.activeParagraphId === paragraph.id}
            activeWordIndex={
              playback.activeParagraphId === paragraph.id ? playback.activeWordIndex : null
            }
            onPlay={onPlayParagraph}
          />
        ))}
      </div>

      <Button type="button" variant="outline" className="w-full shrink-0" onClick={() => addParagraph()}>
        <Plus data-icon="inline-start" />
        Add paragraph
      </Button>
    </div>
  )
}
