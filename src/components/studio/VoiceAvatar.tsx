import { Avatar, AvatarBadge, AvatarFallback } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { voiceInitial } from '@/lib/voice-catalog'
import { voiceRingClass } from '@/lib/voice-colors'
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
    <Avatar
      className={cn('ring-2', voiceRingClass(voiceId, voiceIdsInUse), className)}
      title={voiceId}
    >
      <AvatarFallback
        className={cn(
          'bg-surface font-heading text-xs font-semibold',
          converted ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {voiceInitial(voiceId)}
      </AvatarFallback>
      {status === 'generating' && (
        <AvatarBadge className="border-surface bg-status-generating motion-safe:animate-pulse">
          <Spinner />
        </AvatarBadge>
      )}
      {status === 'done' && <AvatarBadge className="bg-status-converted" />}
      {status === 'error' && <AvatarBadge className="bg-status-error" />}
    </Avatar>
  )
}
