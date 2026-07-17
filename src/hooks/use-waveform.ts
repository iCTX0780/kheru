import { useEffect, useRef } from 'react'

export interface WaveformData {
  samples: number[]
  duration: number
  maxAmplitude: number
}

function placeholderWaveform(duration: number): WaveformData {
  return {
    samples: new Array(500).fill(0.08),
    duration: Math.max(duration, 0.01),
    maxAmplitude: 0.08,
  }
}

export function useWaveform(
  audioUrl: string | null,
  onDataReady: (data: WaveformData) => void,
  options?: { estimatedDuration?: number }
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

    const fetchAndDecodeAudio = async () => {
      try {
        if (audioUrl.startsWith('blob:')) {
          if (cancelled) return
          onDataReadyRef.current(placeholderWaveform(options?.estimatedDuration ?? 1))
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
        console.error('Failed to decode audio:', error)
        if (!cancelled) {
          onDataReadyRef.current(placeholderWaveform(options?.estimatedDuration ?? 1))
        }
      }
    }

    void fetchAndDecodeAudio()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [audioUrl, options?.estimatedDuration])

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [])
}
