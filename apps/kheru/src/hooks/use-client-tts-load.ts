import { useEffect, useState } from 'react'
import { getClientTtsLoadState, subscribeClientTtsLoad } from '@/lib/client-tts/engine'
import type { ClientTtsLoadState } from '@/lib/client-tts/types'

export function useClientTtsLoad(): ClientTtsLoadState {
  const [state, setState] = useState<ClientTtsLoadState>(getClientTtsLoadState)

  useEffect(() => subscribeClientTtsLoad(setState), [])

  return state
}
