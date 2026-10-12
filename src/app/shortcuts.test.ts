import { describe, expect, it, vi } from 'vitest'
import type { Actions } from './actions'
import { matchShortcut, runShortcut, type KeyInput } from './shortcuts'

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target: null, ...mods,
})

describe('matchShortcut', () => {
  it.each([
    [key('Delete'), 'delete'],
    [key('Backspace'), 'delete'],
    [key('d', { metaKey: true }), 'duplicate'],
    [key('g', { ctrlKey: true }), 'group'],
    [key('G', { ctrlKey: true, shiftKey: true }), 'ungroup'],
    [key('z', { metaKey: true }), 'undo'],
    [key('z', { metaKey: true, shiftKey: true }), 'redo'],
    [key('y', { ctrlKey: true }), 'redo'],
    [key('h'), 'toggleHole'],
    [key('m'), 'toolMove'],
    [key('r'), 'toolRotate'],
    [key('s'), 'toolSize'],
    [key('Escape'), 'clearSelection'],
  ] as const)('%o → %s', (input, expected) => {
    expect(matchShortcut(input)).toBe(expected)
  })

  it('ignores keys while typing in a field', () => {
    expect(matchShortcut(key('Backspace', { target: { tagName: 'INPUT' } as unknown as EventTarget }))).toBeNull()
  })

  it('ignores unknown keys and Alt combos', () => {
    expect(matchShortcut(key('q'))).toBeNull()
    expect(matchShortcut(key('h', { altKey: true }))).toBeNull()
    expect(matchShortcut(key('q', { ctrlKey: true }))).toBeNull()
  })
})

describe('runShortcut', () => {
  it('calls the matching action', () => {
    const actions = {
      deleteSelection: vi.fn(), duplicateSelection: vi.fn(), groupSelection: vi.fn(), ungroupSelection: vi.fn(),
      undo: vi.fn(), redo: vi.fn(), toggleHole: vi.fn(), setTool: vi.fn(), clearSelection: vi.fn(),
      addShape: vi.fn(), selectNode: vi.fn(), setGridSnap: vi.fn(), toggleWorkplanePicking: vi.fn(), resetWorkplane: vi.fn(),
    } satisfies Actions
    runShortcut('toolRotate', actions)
    runShortcut('group', actions)
    expect(actions.setTool).toHaveBeenCalledWith('rotate')
    expect(actions.groupSelection).toHaveBeenCalledOnce()
  })
})
