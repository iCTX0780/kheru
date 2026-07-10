import { memo, useCallback, useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HighlightedText } from '@/components/HighlightedText'
import { VoiceAvatar } from '@/components/studio/VoiceAvatar'
import { SlashCommandMenu } from '@/components/studio/SlashCommandMenu'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
import { voiceCueBorderClass, voiceRingClass, voiceRowTintClass } from '@/lib/voice-colors'
import { voiceDisplayName } from '@/lib/voice-catalog'
import type { Paragraph } from '@/stores/studio'
import { useStudioStore } from '@/stores/studio'
import { ChevronDown, ChevronUp, MoreHorizontal, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParagraphBlockProps {
  paragraph: Paragraph
  index: number
  isSelected: boolean
  isActive: boolean
  isPlaying: boolean
  activeWordIndex: number | null
  onSelect: () => void
  onImportOpen?: () => void
}

export const ParagraphBlock = memo(function ParagraphBlock({
  paragraph,
  index,
  isSelected,
  isActive,
  isPlaying,
  activeWordIndex,
  onSelect,
  onImportOpen,
}: ParagraphBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')

  const updateParagraph = useStudioStore((s) => s.updateParagraph)
  const removeParagraph = useStudioStore((s) => s.removeParagraph)
  const moveParagraph = useStudioStore((s) => s.moveParagraph)
  const paragraphs = useStudioStore((s) => s.paragraphs)

  const voiceIdsInUse = paragraphs.map((p) => p.voice)
  const hasText = paragraph.text.trim().length > 0
  const isGenerating = paragraph.status === 'generating'

  useAutoResizeTextarea(textareaRef, paragraph.text)

  const handleChange = useCallback(
    (value: string) => {
      if (value.startsWith('/')) {
        setSlashOpen(true)
        setSlashFilter(value.slice(1))
      } else {
        setSlashOpen(false)
        setSlashFilter('')
      }
      updateParagraph(paragraph.id, { text: value })
    },
    [paragraph.id, updateParagraph]
  )

  const handleSlashSelect = useCallback(
    (commandId: string) => {
      setSlashOpen(false)
      setSlashFilter('')
      if (commandId === 'import') {
        updateParagraph(paragraph.id, { text: '' })
        onImportOpen?.()
        return
      }
      if (commandId === 'new-paragraph') {
        updateParagraph(paragraph.id, { text: '' })
        document.getElementById('script-composer')?.focus()
      }
    },
    [onImportOpen, paragraph.id, updateParagraph]
  )

  return (
    <article
      id={`paragraph-${paragraph.id}`}
      className="flex gap-3"
      onClick={onSelect}
    >
      <VoiceAvatar
        voiceId={paragraph.voice}
        voiceIdsInUse={voiceIdsInUse}
        status={paragraph.status}
      />

      <div className="relative min-w-0 flex-1">
        <div
          className={cn(
            'group relative rounded-lg px-3 py-2.5 transition-colors',
            hasText && voiceRowTintClass(paragraph.voice, voiceIdsInUse),
            isSelected && 'bg-script-selection',
            isActive && !isSelected && 'ring-1',
            isActive && !isSelected && voiceRingClass(paragraph.voice, voiceIdsInUse),
            isPlaying && 'ring-1',
            isPlaying && voiceRingClass(paragraph.voice, voiceIdsInUse),
            isGenerating && 'ring-1 ring-status-generating/40 motion-safe:animate-pulse'
          )}
        >
          <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation()
                moveParagraph(paragraph.id, 'up')
              }}
              aria-label={`Move paragraph ${index + 1} up`}
            >
              <ChevronUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={index === paragraphs.length - 1}
              onClick={(e) => {
                e.stopPropagation()
                moveParagraph(paragraph.id, 'down')
              }}
              aria-label={`Move paragraph ${index + 1} down`}
            >
              <ChevronDown />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Paragraph actions"
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={paragraphs.length <= 1}
                    onClick={() => removeParagraph(paragraph.id)}
                  >
                    <Trash2 />
                    Delete paragraph
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {paragraph.speaker && (
            <div className="mb-1.5 flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'rounded-sm border-l-2 bg-transparent px-1.5 py-0 font-mono text-[0.65rem] uppercase tracking-widest',
                  voiceCueBorderClass(paragraph.voice, voiceIdsInUse)
                )}
              >
                {paragraph.speaker}
              </Badge>
              <span className="font-heading text-[0.65rem] text-muted-foreground">
                {voiceDisplayName(paragraph.voice)}
              </span>
            </div>
          )}

          {isPlaying && hasText ? (
            <div className="text-base leading-relaxed" aria-live="polite">
              <HighlightedText
                text={paragraph.text}
                activeWordIndex={activeWordIndex}
                voiceId={paragraph.voice}
                voiceIdsInUse={voiceIdsInUse}
              />
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                id={`dialogue-${paragraph.id}`}
                value={paragraph.text}
                rows={1}
                onFocus={onSelect}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSlashOpen(false)
                }}
                placeholder={index === 0 && !hasText ? 'Write dialogue…' : undefined}
                className="block w-full resize-none overflow-hidden border-0 bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground"
                aria-label={`Paragraph ${index + 1}`}
              />
              {slashOpen && (
                <SlashCommandMenu filter={slashFilter} onSelect={handleSlashSelect} />
              )}
            </>
          )}
        </div>
      </div>
    </article>
  )
})
