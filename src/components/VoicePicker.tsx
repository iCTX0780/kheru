import { useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
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
import { toast } from 'sonner'
import { getVoicePreviewUrl } from '@/lib/client-tts/voice-preview'
import { LOCALE_LABELS, type VoiceLocale } from '@/lib/voice-catalog'
import type { VoiceInfo } from '@/lib/voices'

const previewAudio = typeof Audio !== 'undefined' ? new Audio() : null
const LOCALE_ORDER: VoiceLocale[] = ['en-us', 'en-gb']

interface VoicePickerProps {
  voices: VoiceInfo[]
  value: string
  onValueChange: (voice: string) => void
  disabled?: boolean
}

export function VoicePicker({ voices, value, onValueChange, disabled }: VoicePickerProps) {
  const playingRef = useRef<string | null>(null)
  const selected = voices.find((v) => v.id === value)

  const groups = useMemo(() => {
    const byLocale = new Map<VoiceLocale, VoiceInfo[]>()
    for (const voice of voices) {
      const list = byLocale.get(voice.locale) ?? []
      list.push(voice)
      byLocale.set(voice.locale, list)
    }
    return LOCALE_ORDER.filter((locale) => (byLocale.get(locale)?.length ?? 0) > 0).map(
      (locale) => ({
        locale,
        label: LOCALE_LABELS[locale],
        voices: byLocale.get(locale) ?? [],
      })
    )
  }, [voices])

  const playPreview = (voiceId: string) => {
    if (!previewAudio) return
    previewAudio.pause()
    playingRef.current = voiceId

    void getVoicePreviewUrl(voiceId)
      .then((url) => {
        if (playingRef.current !== voiceId) return

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
        previewAudio.src = url
        previewAudio.load()
      })
      .catch(() => {
        if (playingRef.current !== voiceId) return
        toast.error('Voice preview failed — model may still be loading')
      })
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
          {groups.map((group) => (
            <SelectGroup key={group.locale}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.voices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {voice.display_name}
                </SelectItem>
              ))}
            </SelectGroup>
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
