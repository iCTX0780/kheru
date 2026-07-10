/** Scroll container for the script timeline — set by ScriptCanvas on mount. */
let timelineViewport: HTMLElement | null = null

export function setTimelineScrollViewport(el: HTMLElement | null) {
  timelineViewport = el
}

export function scrollToParagraph(paragraphId: string, block: ScrollLogicalPosition = 'nearest') {
  const target = document.getElementById(`paragraph-${paragraphId}`)
  if (!target) return

  const viewport = timelineViewport
  if (!viewport) {
    target.scrollIntoView({ block, behavior: 'smooth' })
    return
  }

  const targetRect = target.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  const offsetTop = targetRect.top - viewportRect.top + viewport.scrollTop

  if (block === 'nearest') {
    const targetBottom = offsetTop + targetRect.height
    const viewTop = viewport.scrollTop
    const viewBottom = viewTop + viewport.clientHeight
    if (offsetTop >= viewTop && targetBottom <= viewBottom) return
  }

  let scrollTop = offsetTop
  if (block === 'center') {
    scrollTop = offsetTop - viewport.clientHeight / 2 + targetRect.height / 2
  } else if (block === 'end') {
    scrollTop = offsetTop - viewport.clientHeight + targetRect.height
  }

  viewport.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
}
