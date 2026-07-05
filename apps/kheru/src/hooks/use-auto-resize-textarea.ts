import { useCallback, useLayoutEffect, type RefObject } from 'react'

export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string
) {
  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref])

  useLayoutEffect(() => {
    resize()
  }, [value, resize])

  return resize
}
