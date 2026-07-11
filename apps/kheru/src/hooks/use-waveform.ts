import { useEffect, useRef } from 'react'
import { STREAM_PLAYBACK_THRESHOLD_SECONDS } from '@/lib/playable-audio-url'

export interface WaveformData {
  samples: number[]
  duration: number
  maxAmplitude: number
}

function runIdFromAudioUrl(audioUrl: string): string | null {
  const match = /\/api\/audio\/([0-9a-f]{8})/.exec(audioUrl)
  return match?.[1] ?? null
}

export function useWaveform(
  audioUrl: string | null,
  onDataReady: (data: WaveformData) => void,
  options?: { preferPeaks?: boolean; estimatedDuration?: number }
) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const onDataReadyRef = useRef(onDataReady)

  useEffect(() => {
    onDataReadyRef.current = onDataReady
  })

  useEffect(() => {
    if (!audioUrl) return

    const controller = new AbortController()
    let cancelled = false
    const preferPeaks =
      options?.preferPeaks ||
      (options?.estimatedDuration ?? 0) > STREAM_PLAYBACK_THRESHOLD_SECONDS

    const loadPeaks = async (runId: string) => {
      const response = await fetch(`/api/audio/${runId}/peaks`, { signal: controller.signal })
      if (!response.ok) throw new Error(`Peaks fetch failed (${response.status})`)
      const data = (await response.json()) as WaveformData
      if (!cancelled) onDataReadyRef.current(data)
    }

    const fetchAndDecodeAudio = async () => {
      try {
        const runId = runIdFromAudioUrl(audioUrl)
        if (preferPeaks && runId) {
          await loadPeaks(runId)
          return
        }

        // Blob URLs already hold the WAV in memory — decodeAudioData duplicates PCM (~10× size).
        if (audioUrl.startsWith('blob:')) {
          if (cancelled) return
          const duration = Math.max(options?.estimatedDuration ?? 1, 0.01)
          const samples = new Array(500).fill(0.08)
          onDataReadyRef.current({ samples, duration, maxAmplitude: 0.08 })
          return
        }

        const response = await fetch(audioUrl, { signal: controller.signal })
        const arrayBuffer = await response.arrayBuffer()

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext()
        }

        const audioContext = audioContextRef.current
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        if (cancelled) return

        const channelData = audioBuffer.getChannelData(0)
        const duration = audioBuffer.duration

        const targetSamples = Math.min(1000, channelData.length)
        const step = Math.max(1, Math.floor(channelData.length / targetSamples))
        const samples: number[] = []

        for (let i = 0; i < channelData.length; i += step) {
          let sum = 0
          let count = 0
          for (let j = i; j < Math.min(i + step, channelData.length); j++) {
            sum += Math.abs(channelData[j])
            count++
          }
          samples.push(sum / count)
        }

        const maxAmplitude = Math.max(...samples, 0.0001)
        onDataReadyRef.current({ samples, duration, maxAmplitude })
      } catch (error) {
        if (controller.signal.aborted || cancelled) return
        const runId = runIdFromAudioUrl(audioUrl)
        if (preferPeaks && runId && !cancelled) {
          try {
            await loadPeaks(runId)
          } catch {
            console.error('Failed to load waveform peaks:', error)
          }
          return
        }
        console.error('Failed to decode audio:', error)
      }
    }

    void fetchAndDecodeAudio()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [audioUrl, options?.estimatedDuration, options?.preferPeaks])

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [])
}
