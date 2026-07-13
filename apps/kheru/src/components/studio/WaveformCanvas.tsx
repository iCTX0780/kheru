import { useCallback, useEffect, useRef, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useWaveform, type WaveformData } from '@/hooks/use-waveform'
import { cn } from '@/lib/utils'

interface WaveformCanvasProps {
  audioUrl: string | null
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  disabled?: boolean
  className?: string
  estimatedDuration?: number
}

interface CanvasLayout {
  width: number
  height: number
  dpr: number
  barWidth: number
}

interface CanvasStyles {
  bg: string
  bar: string
  played: string
}

export function WaveformCanvas({
  audioUrl,
  currentTime,
  duration,
  onSeek,
  disabled,
  className,
  estimatedDuration,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<WaveformData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<CanvasLayout | null>(null)
  const stylesRef = useRef<CanvasStyles | null>(null)
  const lastPlayedBarRef = useRef(-1)
  const lastPlayheadXRef = useRef(-1)
  const [decoded, setDecoded] = useState(false)

  const drawStatic = useCallback(() => {
    const canvas = canvasRef.current
    const data = dataRef.current
    const container = containerRef.current
    if (!canvas || !data || !container) return

    const width = container.clientWidth
    const height = container.clientHeight
    if (width <= 0 || height <= 0) return

    const dpr = window.devicePixelRatio || 1
    const needsResize =
      !layoutRef.current ||
      layoutRef.current.width !== width ||
      layoutRef.current.height !== height ||
      layoutRef.current.dpr !== dpr

    if (needsResize) {
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (needsResize) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const styles = getComputedStyle(container)
    stylesRef.current = {
      bg: styles.getPropertyValue('--waveform-bg').trim() || '#1a1a1a',
      bar: styles.getPropertyValue('--waveform-bar').trim() || '#333',
      played: styles.getPropertyValue('--waveform-played').trim() || '#888',
    }

    const { samples, maxAmplitude } = data
    const barWidth = Math.max(1, width / samples.length)
    layoutRef.current = { width, height, dpr, barWidth }

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = stylesRef.current.bg
    ctx.fillRect(0, 0, width, height)

    samples.forEach((sample, i) => {
      const x = i * barWidth
      const barHeight = Math.max(2, (sample / maxAmplitude) * (height - 4))
      const y = (height - barHeight) / 2
      ctx.fillStyle = stylesRef.current!.bar
      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight)
    })

    lastPlayedBarRef.current = -1
    lastPlayheadXRef.current = -1
  }, [])

  const updateProgress = useCallback((time: number, totalDuration: number) => {
    const canvas = canvasRef.current
    const data = dataRef.current
    const layout = layoutRef.current
    const styles = stylesRef.current
    if (!canvas || !data || !layout || !styles) return

    const { width, height, barWidth } = layout
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const progress = totalDuration > 0 ? time / totalDuration : 0
    const progressX = Math.min(progress * width, width)
    const playedBarCount = Math.floor(progressX / barWidth)

    const { samples, maxAmplitude } = data
    const prevPlayed = lastPlayedBarRef.current
    const prevPlayheadX = lastPlayheadXRef.current

    if (playedBarCount > prevPlayed) {
      for (let i = Math.max(0, prevPlayed + 1); i <= playedBarCount && i < samples.length; i++) {
        const x = i * barWidth
        const barHeight = Math.max(2, (samples[i]! / maxAmplitude) * (height - 4))
        const y = (height - barHeight) / 2
        ctx.fillStyle = styles.played
        ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight)
      }
    } else if (playedBarCount < prevPlayed) {
      for (let i = playedBarCount + 1; i <= prevPlayed && i < samples.length; i++) {
        const x = i * barWidth
        const barHeight = Math.max(2, (samples[i]! / maxAmplitude) * (height - 4))
        const y = (height - barHeight) / 2
        ctx.fillStyle = styles.bar
        ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight)
      }
    }

    if (prevPlayheadX >= 0) {
      ctx.fillStyle = styles.bg
      ctx.fillRect(prevPlayheadX, 0, 2, height)
      const barIndex = Math.floor(prevPlayheadX / barWidth)
      if (barIndex >= 0 && barIndex < samples.length) {
        const x = barIndex * barWidth
        const barHeight = Math.max(2, (samples[barIndex]! / maxAmplitude) * (height - 4))
        const y = (height - barHeight) / 2
        ctx.fillStyle = barIndex <= playedBarCount ? styles.played : styles.bar
        ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight)
      }
    }

    const playheadX = Math.min(progressX, width - 1)
    ctx.fillStyle = styles.played
    ctx.fillRect(playheadX, 0, 2, height)

    lastPlayedBarRef.current = playedBarCount
    lastPlayheadXRef.current = playheadX
  }, [])

  useWaveform(
    audioUrl,
    (data) => {
      dataRef.current = data
      setDecoded(true)
      drawStatic()
      updateProgress(currentTime, duration)
    },
    { estimatedDuration }
  )

  useEffect(() => {
    setDecoded(false)
    dataRef.current = null
    layoutRef.current = null
    stylesRef.current = null
    lastPlayedBarRef.current = -1
    lastPlayheadXRef.current = -1
  }, [audioUrl])

  useEffect(() => {
    if (!decoded) return
    updateProgress(currentTime, duration)
  }, [currentTime, duration, decoded, updateProgress])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      drawStatic()
      updateProgress(currentTime, duration)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [currentTime, duration, drawStatic, updateProgress])

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    onSeek(Math.max(0, Math.min(duration, ratio * duration)))
  }

  if (!audioUrl) {
    return <Skeleton className={cn('h-10 w-full rounded-md', className)} />
  }

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Waveform seek"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'relative h-10 w-full cursor-pointer overflow-hidden rounded-md border border-border bg-waveform-bg',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (disabled || !duration) return
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 1))
        if (e.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 1))
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      {!decoded && <Skeleton className="absolute inset-0 rounded-none" aria-hidden />}
    </div>
  )
}
