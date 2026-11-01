import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from '../learn/progress'
import { createMoreShapesStore, MORE_SHAPES_KEY } from './more-shapes-store'

const memory = (): KeyValueStorage => {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

describe('more shapes store', () => {
  it('starts open with empty storage', () => {
    expect(createMoreShapesStore(memory()).getState().open).toBe(true)
    expect(createMoreShapesStore(null).getState().open).toBe(true)
  })

  it('remembers being closed', () => {
    const storage = memory()
    const store = createMoreShapesStore(storage)
    store.getState().toggle()
    expect(store.getState().open).toBe(false)
    expect(storage.getItem(MORE_SHAPES_KEY)).toBe('closed')
    expect(createMoreShapesStore(storage).getState().open).toBe(false)
    store.getState().toggle()
    expect(createMoreShapesStore(storage).getState().open).toBe(true)
  })

  it('still works when storage throws', () => {
    const broken: KeyValueStorage = {
      getItem: () => { throw new Error('no') },
      setItem: () => { throw new Error('no') },
    }
    const store = createMoreShapesStore(broken)
    expect(store.getState().open).toBe(true)
    store.getState().toggle()
    expect(store.getState().open).toBe(false)
  })
})
