import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Volume2 } from 'lucide-react'
import type { VoiceInfo } from '@/lib/api'
import { voiceSampleUrl } from '@/lib/voice-catalog'

const previewAudio = typeof Audio !== 'undefined' ? new Audio() : null

interface VoicePickerProps {
  voices: VoiceInfo[]
  value: string
  onValueChange: (voice: string) => void
  disabled?: boolean
}

function VoiceOption({ voice }: { voice: VoiceInfo }) {
  return (
    <span className="flex items-center gap-2">
      <span>{voice.display_name}</span>
      <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize">
        {voice.engine}
      </Badge>
    </span>
  )
}

export function VoicePicker({ voices, value, onValueChange, disabled }: VoicePickerProps) {
  const playingRef = useRef<string | null>(null)
  const piperVoices = voices.filter((v) => v.engine === 'piper')
  const kokoroVoices = voices.filter((v) => v.engine === 'kokoro')
  const selected = voices.find((v) => v.id === value)

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
          <SelectValue placeholder="Voice">
            {selected ? `${selected.display_name} (${selected.engine})` : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {kokoroVoices.length > 0 && (
            <SelectGroup>
              <SelectLabel>Kokoro</SelectLabel>
              {kokoroVoices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  <VoiceOption voice={voice} />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {piperVoices.length > 0 && (
            <SelectGroup>
              <SelectLabel>Piper (fallback)</SelectLabel>
              {piperVoices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  <VoiceOption voice={voice} />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
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
