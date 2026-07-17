import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SHORTCUTS = [
  { keys: 'Space', description: 'Play or pause (when not typing)' },
  { keys: '↑ / ↓', description: 'Select previous or next paragraph' },
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Esc', description: 'Close dialogs' },
]

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Quick actions for the rehearsal studio.</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-3">
          {SHORTCUTS.map((item) => (
            <div key={item.keys} className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{item.description}</dt>
              <dd>
                <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                  {item.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
