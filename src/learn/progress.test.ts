import { describe, expect, it } from 'vitest'
import { EMPTY_PROGRESS, loadProgress, PROGRESS_KEY, saveProgress, type KeyValueStorage } from './progress'

const memory = (initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return { data, getItem: (k) => (Object.hasOwn(data, k) ? data[k] ?? null : null), setItem: (k, v) => { data[k] = v } }
}
const throwing: KeyValueStorage = {
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('full') },
}

describe('lesson progress storage (Review Focus 4)', () => {
  it('round-trips progress', () => {
    const storage = memory()
    const progress = { done: ['first-shape'], active: { tutorialId: 'smart-sizes', step: 2, designId: 'abc' }, nudgeHidden: true }
    expect(saveProgress(storage, progress)).toBe(true)
    expect(loadProgress(storage)).toEqual(progress)
  })

  it('starts empty with no storage, blocked storage, junk or the wrong shape', () => {
    expect(loadProgress(null)).toEqual(EMPTY_PROGRESS)
    expect(loadProgress(throwing)).toEqual(EMPTY_PROGRESS)
    expect(loadProgress(memory({ [PROGRESS_KEY]: '{not json' }))).toEqual(EMPTY_PROGRESS)
    expect(loadProgress(memory({ [PROGRESS_KEY]: JSON.stringify({ done: 'all' }) }))).toEqual(EMPTY_PROGRESS)
  })

  it('reports a failed save instead of throwing', () => {
    expect(saveProgress(throwing, EMPTY_PROGRESS)).toBe(false)
    expect(saveProgress(null, EMPTY_PROGRESS)).toBe(false)
  })
})
