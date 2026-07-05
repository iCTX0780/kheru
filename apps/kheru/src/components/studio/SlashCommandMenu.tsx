import { FileUp, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SlashCommand {
  id: string
  label: string
  icon: typeof FileUp
  disabled?: boolean
}

const COMMANDS: SlashCommand[] = [
  { id: 'import', label: 'Import script', icon: FileUp },
  { id: 'new-paragraph', label: 'New paragraph', icon: Plus },
]

interface SlashCommandMenuProps {
  filter: string
  onSelect: (commandId: string) => void
  className?: string
}

export function SlashCommandMenu({ filter, onSelect, className }: SlashCommandMenuProps) {
  const query = filter.toLowerCase()
  const items = COMMANDS.filter(
    (cmd) => !query || cmd.label.toLowerCase().includes(query)
  )

  if (items.length === 0) return null

  return (
    <div
      role="listbox"
      className={cn(
        'absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-md',
        className
      )}
    >
      {items.map((cmd) => {
        const Icon = cmd.icon
        return (
          <button
            key={cmd.id}
            type="button"
            role="option"
            disabled={cmd.disabled}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
              'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(cmd.id)
            }}
          >
            <Icon className="size-4 shrink-0 opacity-70" />
            {cmd.label}
          </button>
        )
      })}
    </div>
  )
}
