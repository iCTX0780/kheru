import { splitWords } from '@/lib/playback-words'
import { cn } from '@/lib/utils'

interface HighlightedTextProps {
  text: string
  activeWordIndex: number | null
  className?: string
}

export function HighlightedText({ text, activeWordIndex, className }: HighlightedTextProps) {
  const words = splitWords(text)

  if (words.length === 0) {
    return <p className={cn('text-sm text-muted-foreground italic', className)}>Empty paragraph</p>
  }

  return (
    <p className={cn('text-sm leading-relaxed', className)}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span
            className={cn(
              'rounded px-0.5 transition-colors duration-75',
              activeWordIndex === index && 'bg-primary/30 text-foreground ring-1 ring-primary/40'
            )}
          >
            {word}
          </span>
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  )
}
