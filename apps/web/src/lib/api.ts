import { useQuery, useMutation } from '@tanstack/react-query'

export interface GenerateSegment {
  index: number
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

export interface GenerateResponse {
  run_id: string
  audio_url: string
  segments: GenerateSegment[]
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

const api = {
  voices: async (): Promise<string[]> => {
    const res = await fetch('/api/voices')
    if (!res.ok) throw new Error(await parseError(res))
    const data: { voices: string[] } = await res.json()
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
