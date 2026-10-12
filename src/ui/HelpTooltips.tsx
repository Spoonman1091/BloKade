import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { helpFor, helpKeyOf } from '../help/lookup'

export const TOOLTIP_DELAY_MS = 500
const TIP_WIDTH = 260
const GAP = 6

interface Tip {
  readonly text: string
  readonly top: number
  readonly left: number
}

function tipFor(target: EventTarget | null, suppressKey: string | null): (() => Tip) | null {
  if (!(target instanceof Element)) return null
  const found = helpKeyOf(target)
  if (!found || found.key === suppressKey) return null
  const entry = helpFor(found.key, found.label)
  if (!entry || !entry.tip) return null
  return () => {
    const r = found.element.getBoundingClientRect()
    return { text: entry.tip, top: r.bottom + GAP, left: Math.max(GAP, Math.min(r.left, window.innerWidth - TIP_WIDTH - GAP)) }
  }
}

/** One-sentence help bubbles on hover or focus, after a short wait. */
export function HelpTooltips({ suppressKey, disabled }: { suppressKey: string | null; disabled: boolean }) {
  const [tip, setTip] = useState<Tip | null>(null)
  useEffect(() => {
    setTip(null)
    if (disabled) return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: HTMLElement | null = null
    const hide = (): void => {
      clearTimeout(timer)
      current = null
      setTip(null)
    }
    const show = (event: Event): void => {
      const found = event.target instanceof Element ? helpKeyOf(event.target) : null
      if (found && found.element === current) return
      hide()
      const make = tipFor(event.target, suppressKey)
      if (make && found) {
        current = found.element
        timer = setTimeout(() => setTip(make()), TOOLTIP_DELAY_MS)
      }
    }
    const onOut = (event: Event): void => {
      if (event instanceof MouseEvent && event.relatedTarget === null) hide()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide()
    }
    const listeners: [string, EventListener][] = [
      ['pointerover', show], ['focusin', show], ['pointerout', onOut], ['focusout', hide], ['keydown', onKey as EventListener],
    ]
    for (const [type, fn] of listeners) document.addEventListener(type, fn)
    window.addEventListener('scroll', hide, true)
    return () => {
      hide()
      for (const [type, fn] of listeners) document.removeEventListener(type, fn)
      window.removeEventListener('scroll', hide, true)
    }
  }, [suppressKey, disabled])
  return tip
    ? createPortal(<div className="help-tooltip" role="tooltip" data-testid="help-tooltip" style={{ top: tip.top, left: tip.left }}>{tip.text}</div>, document.body)
    : null
}
