import { useQuery, useMutation } from '@tanstack/react-query'

export interface VoiceInfo {
  id: string
  engine: 'kokoro'
  display_name: string
  gender: 'male' | 'female'
  default_length_scale: number
}

export interface GenerateSegment {
  index: number
  start: number
  end: number
}

export interface GenerateWord {
  index: number
  word: string
  start: number
  end: number
}

export interface GenerateTurn {
  speaker: string
  voice: string
  text: string
  length_scale: number
  gap_after?: number
}

export interface GenerateClip {
  index: number
  run_id: string
  audio_url: string
}

export interface GenerateResponse {
  run_id: string
  audio_url: string
  segments: GenerateSegment[]
  words: GenerateWord[]
  clips: GenerateClip[]
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data.detail === 'string') return data.detail
    if (Array.isArray(data.detail)) {
      return data.detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join(', ')
    }
    return res.statusText || 'Request failed'
  } catch {
    return res.statusText || 'Request failed'
  }
}

export interface StitchResponse {
  run_id: string
  audio_url: string
}

const api = {
  voices: async (): Promise<VoiceInfo[]> => {
    const res = await fetch('/api/voices')
    if (!res.ok) throw new Error(await parseError(res))
    const data: { voices: VoiceInfo[] } = await res.json()
    return data.voices
  },

  generate: async (conversation: GenerateTurn[]): Promise<GenerateResponse> => {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  stitch: async (runIds: string[]): Promise<StitchResponse> => {
    const res = await fetch('/api/stitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_ids: runIds }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },
}

export async function stitchRunIds(runIds: string[]): Promise<StitchResponse> {
  return api.stitch(runIds)
}

export function useVoices() {
  return useQuery({
    queryKey: ['voices'],
    queryFn: api.voices,
  })
}

export function useGenerate() {
  return useMutation({
    mutationFn: (conversation: GenerateTurn[]) => api.generate(conversation),
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error(await parseError(res))
      return res.json() as Promise<
        { id: string; title: string; chapters: unknown[]; activeChapterId: string; updatedAt: string }[]
      >
    },
    staleTime: 30_000,
  })
}

export function turnFromParagraph(
  id: string,
  text: string,
  voice: string,
  lengthScale: number
): GenerateTurn {
  return {
    speaker: `block-${id}`,
    voice,
    text,
    length_scale: lengthScale,
  }
}

export function wordTimingsForTurn(words: GenerateWord[] | undefined, turnIndex: number) {
  return (words ?? [])
    .filter((word) => word.index === turnIndex)
    .map((word) => ({ word: word.word, start: word.start, end: word.end }))
}

/** Prefer server segment timing; avoids a second client decode after generate. */
export function segmentDurationFromResult(result: GenerateResponse, turnIndex = 0): number | null {
  const segment = result.segments.find((s) => s.index === turnIndex)
  if (!segment) return null
  const duration = segment.end - segment.start
  return Number.isFinite(duration) && duration > 0 ? duration : null
}
