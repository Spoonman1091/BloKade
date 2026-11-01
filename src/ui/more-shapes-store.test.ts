import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from '../learn/progress'
import { createMoreShapesStore, MORE_SHAPES_KEY } from './more-shapes-store'

const memory = (): KeyValueStorage => {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

describe('more shapes store', () => {
  it('starts closed and new with empty storage', () => {
    for (const storage of [memory(), null]) {
      const state = createMoreShapesStore(storage).getState()
      expect(state.open).toBe(false)
      expect(state.isNew).toBe(true)
    }
  })

  it('stops being new once opened, and remembers it', () => {
    const storage = memory()
    const store = createMoreShapesStore(storage)
    store.getState().toggle()
    expect(store.getState()).toMatchObject({ open: true, isNew: false })
    expect(storage.getItem(MORE_SHAPES_KEY)).toBe('open')
    expect(createMoreShapesStore(storage).getState()).toMatchObject({ open: true, isNew: false })
  })

  it('remembers being closed again, without the badge', () => {
    const storage = memory()
    const store = createMoreShapesStore(storage)
    store.getState().toggle()
    store.getState().toggle()
    expect(storage.getItem(MORE_SHAPES_KEY)).toBe('closed')
    expect(createMoreShapesStore(storage).getState()).toMatchObject({ open: false, isNew: false })
  })

  it('treats any already-saved value as seen', () => {
    for (const saved of ['open', 'closed']) {
      const storage = memory()
      storage.setItem(MORE_SHAPES_KEY, saved)
      expect(createMoreShapesStore(storage).getState()).toMatchObject({ open: saved === 'open', isNew: false })
    }
  })

  it('still works when storage throws', () => {
    const broken: KeyValueStorage = {
      getItem: () => { throw new Error('no') },
      setItem: () => { throw new Error('no') },
    }
    const store = createMoreShapesStore(broken)
    expect(store.getState()).toMatchObject({ open: false, isNew: true })
    store.getState().toggle()
    expect(store.getState()).toMatchObject({ open: true, isNew: false })
    store.getState().toggle()
    expect(store.getState().open).toBe(false)
  })
})
