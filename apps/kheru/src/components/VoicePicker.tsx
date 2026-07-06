import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import type { VoiceInfo } from '@/lib/api'
import { voiceSampleUrl } from '@/lib/voice-catalog'

const previewAudio = typeof Audio !== 'undefined' ? new Audio() : null

interface VoicePickerProps {
  voices: VoiceInfo[]
  value: string
  onValueChange: (voice: string) => void
  disabled?: boolean
}

export function VoicePicker({ voices, value, onValueChange, disabled }: VoicePickerProps) {
  const playingRef = useRef<string | null>(null)
  const selected = voices.find((v) => v.id === value)

  const playPreview = (voiceId: string) => {
    if (!previewAudio) return
    previewAudio.pause()
    playingRef.current = voiceId

    const onReady = () => {
      previewAudio.removeEventListener('canplaythrough', onReady)
      previewAudio.removeEventListener('error', onError)
      if (playingRef.current !== voiceId) return
      void previewAudio.play().catch(() => {
        toast.error('Voice preview failed — try again in a moment')
      })
    }

    const onError = () => {
      previewAudio.removeEventListener('canplaythrough', onReady)
      previewAudio.removeEventListener('error', onError)
      if (playingRef.current !== voiceId) return
      toast.error('Voice preview failed — first preview may take up to a minute')
    }

    previewAudio.addEventListener('canplaythrough', onReady, { once: true })
    previewAudio.addEventListener('error', onError, { once: true })
    previewAudio.src = voiceSampleUrl(voiceId)
    previewAudio.load()
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Select value={value} onValueChange={(v) => v && onValueChange(v)} disabled={disabled}>
        <SelectTrigger className="h-8 flex-1 min-w-0 text-sm">
          <SelectValue placeholder="Voice">
            {selected ? selected.display_name : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {voices.map((voice) => (
            <SelectItem key={voice.id} value={voice.id}>
              {voice.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        disabled={disabled || !value}
        onClick={() => playPreview(value)}
        aria-label="Preview voice"
      >
        <Volume2 className="size-3.5" />
      </Button>
    </div>
  )
}
