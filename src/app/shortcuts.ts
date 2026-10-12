import { useEffect } from 'react'
import type { Actions } from './actions'

export type ShortcutAction =
  | 'delete' | 'duplicate' | 'group' | 'ungroup' | 'undo' | 'redo'
  | 'toggleHole' | 'toolMove' | 'toolRotate' | 'toolSize' | 'cancel'

export interface KeyInput {
  readonly key: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly target: EventTarget | null
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof target !== 'object' || target === null) return false
  const element = target as { tagName?: unknown; isContentEditable?: unknown }
  return (typeof element.tagName === 'string' && TYPING_TAGS.has(element.tagName)) || element.isContentEditable === true
}

/** [without Shift, with Shift] for Ctrl/Cmd combos. */
const WITH_MODIFIER: Readonly<Record<string, readonly [ShortcutAction, ShortcutAction]>> = {
  z: ['undo', 'redo'],
  y: ['redo', 'redo'],
  d: ['duplicate', 'duplicate'],
  g: ['group', 'ungroup'],
}

const PLAIN: Readonly<Record<string, ShortcutAction>> = {
  delete: 'delete',
  backspace: 'delete',
  h: 'toggleHole',
  m: 'toolMove',
  r: 'toolRotate',
  s: 'toolSize',
  escape: 'cancel',
}

export function matchShortcut(input: KeyInput): ShortcutAction | null {
  if (input.altKey || isTypingTarget(input.target)) return null
  const key = input.key.toLowerCase()
  if (input.ctrlKey || input.metaKey) {
    const pair = WITH_MODIFIER[key]
    return pair ? pair[input.shiftKey ? 1 : 0] : null
  }
  return PLAIN[key] ?? null
}

export function runShortcut(action: ShortcutAction, actions: Actions): void {
  const table: Record<ShortcutAction, () => void> = {
    delete: actions.deleteSelection,
    duplicate: actions.duplicateSelection,
    group: actions.groupSelection,
    ungroup: actions.ungroupSelection,
    undo: actions.undo,
    redo: actions.redo,
    toggleHole: actions.toggleHole,
    toolMove: () => actions.setTool('move'),
    toolRotate: () => actions.setTool('rotate'),
    toolSize: () => actions.setTool('size'),
    cancel: actions.cancel,
  }
  table[action]()
}

export function useShortcuts(actions: Actions, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = matchShortcut(event)
      if (!action) return
      event.preventDefault()
      runShortcut(action, actions)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, enabled])
}
