import { useEffect, useState } from 'react'
import { helpFor, helpKeyOf, NO_HELP } from '../help/lookup'
import type { HelpEntry } from '../help/types'
import { RichText } from './RichText'

const BLOCKED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'dragstart', 'dragover', 'drop'] as const
/** Keyboard and edit events that could change the design from a focused field. Tab only moves focus, so it stays. */
const KEY_EDITS = ['keydown', 'keypress', 'beforeinput', 'input', 'change'] as const
const SAFE_TARGET = '.help-card, [data-help-toggle]'

interface HelpModeProps {
  active: boolean
  onExit(): void
  onLearnMore(tutorialId: string): void
}

function HelpCard({ entry, onClose, onLearnMore }: { entry: HelpEntry; onClose(): void; onLearnMore(id: string): void }) {
  return (
    <div className="help-card" role="dialog" aria-label="Help" data-testid="help-card">
      <p><RichText text={entry.card} /></p>
      {entry.tryIt && <p className="hint">Try it: {entry.tryIt}</p>}
      <div className="lesson-actions">
        {entry.tutorial && (
          <button type="button" className="tool-button" data-testid="help-card-learn"
            onClick={() => onLearnMore(entry.tutorial ?? '')}>Learn more →</button>
        )}
        <button type="button" className="tool-button" data-testid="help-card-close" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

/** ❓ help mode: clicks show what a control does instead of doing it. Nothing in the design changes. */
export function HelpMode({ active, onExit, onLearnMore }: HelpModeProps) {
  const [card, setCard] = useState<HelpEntry | null>(null)
  useEffect(() => {
    setCard(null)
    if (!active) return undefined
    const block = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Element) || target.closest(SAFE_TARGET)) return
      event.preventDefault()
      event.stopPropagation()
      if (event.type !== 'click') return
      const found = helpKeyOf(target)
      setCard((found && helpFor(found.key, found.label)) ?? NO_HELP)
    }
    const onKey = (event: Event): void => {
      const key = event instanceof KeyboardEvent ? event.key : null
      if (key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onExit()
        return
      }
      const target = event.target
      if (key === 'Tab' || (target instanceof Element && target.closest(SAFE_TARGET))) return
      event.preventDefault()
      event.stopPropagation()
    }
    const focused = document.activeElement
    if (focused instanceof HTMLElement && !focused.closest('[data-help-toggle]')) focused.blur()
    for (const type of BLOCKED) window.addEventListener(type, block, true)
    for (const type of KEY_EDITS) window.addEventListener(type, onKey, true)
    document.body.classList.add('help-mode')
    return () => {
      for (const type of BLOCKED) window.removeEventListener(type, block, true)
      for (const type of KEY_EDITS) window.removeEventListener(type, onKey, true)
      document.body.classList.remove('help-mode')
    }
  }, [active, onExit])
  if (!active || !card) return null
  return <HelpCard entry={card} onClose={onExit} onLearnMore={onLearnMore} />
}
