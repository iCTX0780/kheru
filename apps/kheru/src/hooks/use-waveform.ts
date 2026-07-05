import { useEffect, useRef } from 'react'

export interface WaveformData {
  samples: number[]
  duration: number
  maxAmplitude: number
}

export function useWaveform(
  audioUrl: string | null,
  onDataReady: (data: WaveformData) => void
) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const onDataReadyRef = useRef(onDataReady)

  useEffect(() => {
    onDataReadyRef.current = onDataReady
  })

  useEffect(() => {
    if (!audioUrl) return

    let cancelled = false

    const fetchAndDecodeAudio = async () => {
      try {
        const response = await fetch(audioUrl)
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
        console.error('Failed to decode audio:', error)
      }
    }

    fetchAndDecodeAudio()

    return () => {
      cancelled = true
    }
  }, [audioUrl])

  useEffect(() => {
    return () => {
      audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [])
}
