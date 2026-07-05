import { useCallback, useRef, useState } from 'react'
import { SlashCommandMenu } from '@/components/studio/SlashCommandMenu'
import { useStudioStore } from '@/stores/studio'
import { cn } from '@/lib/utils'

interface ScriptComposerProps {
  onImportOpen?: () => void
  onParagraphCreated?: (paragraphId: string) => void
}

export function ScriptComposer({ onImportOpen, onParagraphCreated }: ScriptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')

  const addParagraph = useStudioStore((s) => s.addParagraph)
  const updateParagraph = useStudioStore((s) => s.updateParagraph)
  const setSelectedParagraphId = useStudioStore((s) => s.setSelectedParagraphId)
  const selectedParagraphId = useStudioStore((s) => s.selectedParagraphId)

  const commitDraft = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return null

      addParagraph(selectedParagraphId ?? undefined)
      const { paragraphs } = useStudioStore.getState()
      const created = paragraphs[paragraphs.length - 1]
      if (!created) return null

      updateParagraph(created.id, { text: trimmed })
      setSelectedParagraphId(created.id)
      onParagraphCreated?.(created.id)
      return created.id
    },
    [addParagraph, onParagraphCreated, selectedParagraphId, setSelectedParagraphId, updateParagraph]
  )

  const handleChange = useCallback(
    (value: string) => {
      if (value.startsWith('/')) {
        setSlashOpen(true)
        setSlashFilter(value.slice(1))
        setDraft(value)
        return
      }

      setSlashOpen(false)
      setSlashFilter('')

      if (draft.length === 0 && value.length > 0) {
        addParagraph(selectedParagraphId ?? undefined)
        const { paragraphs: nextParagraphs } = useStudioStore.getState()
        const created = nextParagraphs[nextParagraphs.length - 1]
        if (created) {
          updateParagraph(created.id, { text: value })
          setSelectedParagraphId(created.id)
          setDraft('')
          requestAnimationFrame(() => {
            document.getElementById(`dialogue-${created.id}`)?.focus()
          })
        }
        return
      }

      setDraft(value)
    },
    [addParagraph, draft.length, selectedParagraphId, setSelectedParagraphId, updateParagraph]
  )

  const handleSlashSelect = useCallback(
    (commandId: string) => {
      setSlashOpen(false)
      setSlashFilter('')
      setDraft('')
      if (commandId === 'import') {
        onImportOpen?.()
        return
      }
      textareaRef.current?.focus()
    },
    [onImportOpen]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        setSlashOpen(false)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && draft.trim()) {
        e.preventDefault()
        const id = commitDraft(draft)
        setDraft('')
        if (id) {
          requestAnimationFrame(() => textareaRef.current?.focus())
        }
      }
    },
    [commitDraft, draft]
  )

  return (
    <div className="flex gap-3">
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border"
        aria-hidden
      />

      <div className="relative min-w-0 flex-1">
        <textarea
          ref={textareaRef}
          id="script-composer"
          value={draft}
          rows={1}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing or press '/' for commands…"
          className={cn(
            'block w-full resize-none overflow-hidden border-0 bg-transparent py-2.5 text-base leading-relaxed',
            'text-muted-foreground outline-none placeholder:text-muted-foreground'
          )}
          aria-label="New paragraph"
        />
        {slashOpen && (
          <SlashCommandMenu filter={slashFilter} onSelect={handleSlashSelect} />
        )}
      </div>
    </div>
  )
}
