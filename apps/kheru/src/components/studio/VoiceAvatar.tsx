import { voiceInitial } from '@/lib/voice-catalog'
import { voiceAccentTickClass, voiceRingClass } from '@/lib/voice-colors'
import type { ParagraphStatus } from '@/stores/studio'
import { cn } from '@/lib/utils'

interface VoiceAvatarProps {
  voiceId: string
  voiceIdsInUse: string[]
  status: ParagraphStatus
  className?: string
}

export function VoiceAvatar({ voiceId, voiceIdsInUse, status, className }: VoiceAvatarProps) {
  const converted = status === 'done' || status === 'stale'

  return (
    <div className={cn('relative flex size-8 shrink-0 items-center justify-center', className)}>
      <div
        className={cn(
          'flex size-8 items-center justify-center rounded-full bg-background text-xs font-semibold ring-2',
          voiceRingClass(voiceId, voiceIdsInUse),
          converted ? 'text-foreground' : 'text-muted-foreground'
        )}
        title={voiceId}
      >
        {voiceInitial(voiceId)}
      </div>
      <span
        className={cn(
          'absolute -right-0.5 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full',
          voiceAccentTickClass(voiceId, voiceIdsInUse)
        )}
        aria-hidden
      />
    </div>
  )
}
