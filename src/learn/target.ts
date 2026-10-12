import { useEffect, useState } from 'react'

export interface TargetRect {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

const TEST_ID = /^[a-z0-9-]+$/

function insideScrollParents(el: Element, rect: DOMRect): boolean {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY
    if (overflow !== 'auto' && overflow !== 'scroll') continue
    const box = parent.getBoundingClientRect()
    if (rect.bottom <= box.top || rect.top >= box.bottom) return false
  }
  return true
}

/** Where a control is on screen, or null when it isn't visible (missing, zero size, off screen or scrolled away). */
export function findTargetRect(testId: string, doc: Document = document): TargetRect | null {
  if (!TEST_ID.test(testId)) return null
  const el = doc.querySelector(`[data-testid="${testId}"]`)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const view = doc.defaultView
  const onScreen = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
    && (!view || (rect.top < view.innerHeight && rect.left < view.innerWidth))
  return onScreen && insideScrollParents(el, rect) ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null
}

const same = (a: TargetRect | null, b: TargetRect | null): boolean =>
  a === b || (a !== null && b !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)

/** Follows a control around as panels scroll, open and resize. */
export function useTargetRect(testId: string | undefined, intervalMs = 250): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null)
  useEffect(() => {
    if (!testId) {
      setRect(null)
      return undefined
    }
    const update = (): void => setRect((previous) => {
      const next = findTargetRect(testId)
      return same(previous, next) ? previous : next
    })
    update()
    const timer = setInterval(update, intervalMs)
    return () => clearInterval(timer)
  }, [testId, intervalMs])
  return rect
}
