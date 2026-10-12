import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, commit, createHistory, HISTORY_LIMIT, redo, undo } from './history'

describe('history', () => {
  it('undoes and redoes', () => {
    const h = commit(commit(createHistory(1), 2), 3)
    expect(undo(h).present).toBe(2)
    expect(redo(undo(h)).present).toBe(3)
    expect(canUndo(h)).toBe(true)
    expect(canRedo(h)).toBe(false)
  })

  it('clears redo after a new commit', () => {
    const h = commit(undo(commit(createHistory(1), 2)), 5)
    expect(h.present).toBe(5)
    expect(canRedo(h)).toBe(false)
  })

  it('ignores commits of the same value', () => {
    const h = createHistory(1)
    expect(commit(h, 1)).toBe(h)
  })

  it('is a no-op at the ends', () => {
    const h = createHistory(1)
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    const h = Array.from({ length: 250 }, (_, i) => i + 1).reduce(commit, createHistory(0))
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toBe(50)
  })
})
