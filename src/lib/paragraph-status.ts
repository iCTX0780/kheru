import type { ParagraphStatus } from '@/stores/studio'

export function paragraphStatusRailClass(status: ParagraphStatus): string {
  switch (status) {
    case 'done':
      return 'bg-status-converted'
    case 'stale':
      return 'bg-status-stale'
    case 'generating':
      return 'bg-status-generating motion-safe:animate-pulse'
    case 'error':
      return 'bg-status-error'
    default:
      return 'bg-status-unconverted'
  }
}

export function paragraphStatusLabel(status: ParagraphStatus): string {
  switch (status) {
    case 'done':
      return 'Generated'
    case 'stale':
      return 'Stale'
    case 'generating':
      return 'Generating'
    case 'error':
      return 'Error'
    default:
      return 'Not generated'
  }
}
