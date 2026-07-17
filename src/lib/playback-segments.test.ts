import { describe, expect, it } from 'vitest'
import { findSegmentRegionForTime } from './playback-segments'
import type { PlaybackSegment } from '@/stores/studio'

const segments: PlaybackSegment[] = [
  { paragraphId: 'a', start: 0, end: 5, label: 'First' },
  { paragraphId: 'b', start: 5.4, end: 10.4, label: 'Second' },
]

describe('findSegmentRegionForTime', () => {
  it('keeps the first paragraph active during the inter-paragraph gap', () => {
    const region = findSegmentRegionForTime(segments, 5.2, 10.4)
    expect(region?.segment.paragraphId).toBe('a')
    expect(region?.regionEnd).toBe(5.4)
  })

  it('returns the active speech segment before the gap ends', () => {
    const region = findSegmentRegionForTime(segments, 4.5, 10.4)
    expect(region?.segment.paragraphId).toBe('a')
  })

  it('switches to the next paragraph once its region starts', () => {
    const region = findSegmentRegionForTime(segments, 5.4, 10.4)
    expect(region?.segment.paragraphId).toBe('b')
  })
})
