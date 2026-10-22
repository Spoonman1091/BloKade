// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GeometryClient } from '../geometry/client'
import { cubeMesh } from '../geometry/testing/meshes'
import { MAX_STL_BYTES, NOT_STL, TOO_BIG_FILE } from '../import/limits'
import { createEmptyDocument } from '../document/factory'
import { createBloKadeStore } from '../store/store'
import { preparedModel } from './testing/prepared'
import { useStlImport } from './useStlImport'

const setup = (prepareStl: () => Promise<unknown>) => {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const client = { prepareStl } as unknown as GeometryClient
  return { store, ...renderHook(() => useStlImport(client, store)) }
}
const fileOf = (bytes = 8) => new File([new Uint8Array(bytes)], 'a.stl')

describe('useStlImport', () => {
  it('refuses a file over the limit without reading it', () => {
    const prepareStl = vi.fn()
    const { store, result } = setup(prepareStl)
    const big = fileOf()
    Object.defineProperty(big, 'size', { value: MAX_STL_BYTES + 1 })
    act(() => result.current.choose(big))
    expect(store.getState().notice).toBe(TOO_BIG_FILE)
    expect(prepareStl).not.toHaveBeenCalled()
  })

  it('sets pending when the file is ready, then confirm adds it', async () => {
    const model = preparedModel(cubeMesh(2))
    const { store, result } = setup(async () => ({ ok: true, model }))
    act(() => result.current.choose(fileOf()))
    await waitFor(() => expect(result.current.pending).toEqual({ fileName: 'a.stl', model }))
    act(() => result.current.confirm('mm'))
    expect(result.current.pending).toBeNull()
    expect(Object.keys(store.getState().history.present.nodes)).toHaveLength(1)
  })

  it('shows the message when the file is refused', async () => {
    const { store, result } = setup(async () => ({ ok: false, message: 'Nope.' }))
    act(() => result.current.choose(fileOf()))
    await waitFor(() => expect(store.getState().notice).toBe('Nope.'))
    expect(result.current.pending).toBeNull()
    expect(result.current.busy).toBe(false)
  })

  it('turns a failed prepare into a friendly notice', async () => {
    const { store, result } = setup(() => Promise.reject(new Error('worker died')))
    act(() => result.current.choose(fileOf()))
    await waitFor(() => expect(store.getState().notice).toBe(NOT_STL))
    expect(result.current.busy).toBe(false)
  })

  it('cancel clears pending', async () => {
    const { result } = setup(async () => ({ ok: true, model: preparedModel(cubeMesh(1)) }))
    act(() => result.current.choose(fileOf()))
    await waitFor(() => expect(result.current.pending).not.toBeNull())
    act(() => result.current.cancel())
    expect(result.current.pending).toBeNull()
  })
})
