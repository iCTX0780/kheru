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
  preferPeaks?: boolean
  estimatedDuration?: number
}

export function WaveformCanvas({
  audioUrl,
  currentTime,
  duration,
  onSeek,
  disabled,
  className,
  preferPeaks,
  estimatedDuration,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<WaveformData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [decoded, setDecoded] = useState(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const data = dataRef.current
    const container = containerRef.current
    if (!canvas || !data || !container) return

    const width = container.clientWidth
    const height = container.clientHeight
    if (width <= 0 || height <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const styles = getComputedStyle(container)
    const bg = styles.getPropertyValue('--waveform-bg').trim() || '#1a1a1a'
    const bar = styles.getPropertyValue('--waveform-bar').trim() || '#333'
    const played = styles.getPropertyValue('--waveform-played').trim() || '#888'

    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    const { samples, maxAmplitude } = data
    const barWidth = Math.max(1, width / samples.length)
    const progress = duration > 0 ? currentTime / duration : 0
    const progressX = progress * width

    samples.forEach((sample, i) => {
      const x = i * barWidth
      const barHeight = Math.max(2, (sample / maxAmplitude) * (height - 4))
      const y = (height - barHeight) / 2
      ctx.fillStyle = x + barWidth <= progressX ? played : bar
      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight)
    })

    ctx.fillStyle = played
    ctx.fillRect(Math.min(progressX, width - 1), 0, 2, height)
  }, [currentTime, duration])

  useWaveform(
    audioUrl,
    (data) => {
      dataRef.current = data
      setDecoded(true)
      draw()
    },
    { preferPeaks, estimatedDuration }
  )

  useEffect(() => {
    setDecoded(false)
    dataRef.current = null
  }, [audioUrl])

  useEffect(() => {
    draw()
  }, [draw, currentTime, duration])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => draw())
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw])

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
