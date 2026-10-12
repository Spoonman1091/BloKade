// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { AUTOSAVE_DELAY_MS } from '../persistence/autosave'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import { createFakeTabBus } from '../persistence/testing/fake-tab-channel'
import { createBloKadeStore } from '../store/store'
import { OPEN_IN_ANOTHER_TAB, useAutosave } from './useAutosave'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const box = () => createShapeNode({ shapeType: 'box', name: 'Box', params: {}, color: '#fff' })

function tab(bus: ReturnType<typeof createFakeTabBus>, designId: string) {
  const repo = createMemoryDesignRepository()
  const save = vi.spyOn(repo, 'save')
  const store = createBloKadeStore({ designId, doc: createEmptyDocument() })
  const hook = renderHook(() => useAutosave(store, repo, bus.open))
  return { store, save, hook }
}

describe('useAutosave', () => {
  it('saves 1 s after a change', async () => {
    const a = tab(createFakeTabBus(), 'x')
    act(() => a.store.getState().apply((d) => addNode(d, box())))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(a.save).toHaveBeenCalledOnce()
  })

  it('stops saving and warns when the design is opened in another tab', async () => {
    const bus = createFakeTabBus()
    const a = tab(bus, 'x')
    act(() => a.store.getState().apply((d) => addNode(d, box())))
    tab(bus, 'x')
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    act(() => a.store.getState().apply((d) => addNode(d, box())))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    await act(() => a.hook.result.current())
    expect(a.save).not.toHaveBeenCalled()
    expect(a.store.getState().stickyNotice).toBe(OPEN_IN_ANOTHER_TAB)
  })

  it('keeps working again after the locked tab opens a different design', async () => {
    const bus = createFakeTabBus()
    const a = tab(bus, 'x')
    tab(bus, 'x')
    expect(a.store.getState().stickyNotice).toBe(OPEN_IN_ANOTHER_TAB)
    act(() => a.store.getState().openDesign('y', createEmptyDocument('Y')))
    expect(a.store.getState().stickyNotice).toBeNull()
    act(() => a.store.getState().apply((d) => addNode(d, box())))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(a.save).toHaveBeenCalled()
    expect(a.save.mock.calls.every(([id]) => id === 'y')).toBe(true)
  })

  it('does not lock itself when React mounts the hook twice', async () => {
    const repo = createMemoryDesignRepository()
    const save = vi.spyOn(repo, 'save')
    const store = createBloKadeStore({ designId: 'x', doc: createEmptyDocument() })
    renderHook(() => useAutosave(store, repo, createFakeTabBus().open), { wrapper: StrictMode })
    act(() => store.getState().apply((d) => addNode(d, box())))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(store.getState().stickyNotice).toBeNull()
    expect(save).toHaveBeenCalledOnce()
  })

  it('works without BroadcastChannel', async () => {
    const repo = createMemoryDesignRepository()
    const save = vi.spyOn(repo, 'save')
    const store = createBloKadeStore({ designId: 'x', doc: createEmptyDocument() })
    renderHook(() => useAutosave(store, repo, () => null))
    act(() => store.getState().apply((d) => addNode(d, box())))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(save).toHaveBeenCalledOnce()
  })
})
