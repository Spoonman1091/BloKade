import { HELP_PATTERNS } from './help-patterns'
import { HELP_TEXTS } from './help-texts'
import type { HelpEntry } from './types'

export const NO_HELP: HelpEntry = { tip: '', card: 'No help for this yet.' }

const MAX_LABEL = 40

function visibleText(el: Element): string {
  const parts: string[] = []
  const walk = (node: Node): void => {
    if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') return
    if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '')
    node.childNodes.forEach(walk)
  }
  walk(el)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

function labelOf(el: HTMLElement): string {
  const fieldLabel = el.closest('label')?.querySelector('span')
  const text = el.getAttribute('aria-label') ?? (fieldLabel ? visibleText(fieldLabel) : visibleText(el))
  return text.slice(0, MAX_LABEL)
}

/** The help id of the control under the pointer: the nearest data-help, else the nearest data-testid. */
export function helpKeyOf(target: Element): { key: string; label: string; element: HTMLElement } | null {
  const el = target.closest<HTMLElement>('[data-help], [data-testid]')
  if (!el) return null
  const key = el.getAttribute('data-help') ?? el.getAttribute('data-testid') ?? ''
  return key ? { key, label: labelOf(el), element: el } : null
}

export function helpFor(key: string, label = ''): HelpEntry | null {
  if (Object.hasOwn(HELP_TEXTS, key)) return HELP_TEXTS[key] ?? null
  for (const p of HELP_PATTERNS) {
    const match = key.match(p.pattern)
    if (match) return p.entry(label || key, match)
  }
  return null
}
