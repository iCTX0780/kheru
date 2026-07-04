import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Volume2 } from 'lucide-react'
import { voiceDisplayName, voiceSampleUrl } from '@/lib/voices'

const previewAudio = typeof Audio !== 'undefined' ? new Audio() : null

interface VoicePickerProps {
  voices: string[]
  value: string
  onValueChange: (voice: string) => void
  disabled?: boolean
}

export function VoicePicker({ voices, value, onValueChange, disabled }: VoicePickerProps) {
  const playingRef = useRef<string | null>(null)

  const playPreview = (voiceId: string) => {
    if (!previewAudio) return
    previewAudio.pause()
    previewAudio.src = voiceSampleUrl(voiceId)
    playingRef.current = voiceId
    void previewAudio.play()
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Select value={value} onValueChange={(v) => v && onValueChange(v)} disabled={disabled}>
        <SelectTrigger className="h-8 flex-1 min-w-0 text-sm">
          <SelectValue placeholder="Voice" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {voices.map((voice) => (
              <SelectItem key={voice} value={voice}>
                {voiceDisplayName(voice)}
              </SelectItem>
            ))}
          </SelectGroup>
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
