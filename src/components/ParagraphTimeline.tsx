import { ScriptCanvas } from '@/components/studio/ScriptCanvas'
import type { VoiceInfo } from '@/lib/voices'

interface ParagraphTimelineProps {
  voices: VoiceInfo[]
  hydrated?: boolean
  onImportOpen?: () => void
}

/** @deprecated Use ScriptCanvas inside StudioShell */
export function ParagraphTimeline({ voices, hydrated = true, onImportOpen }: ParagraphTimelineProps) {
  return <ScriptCanvas voices={voices} hydrated={hydrated} onImportOpen={onImportOpen} />
}
