// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { GeometryTimeoutError, type GeometryClient } from '../geometry/client'
import type { BuildResult } from '../geometry/types'
import { TOO_LONG } from '../kade/messages'
import { createBloKadeStore } from '../store/store'
import { useGeometrySync } from './useGeometrySync'

const tooLong: BuildResult = { nodes: { robot: { status: 'error', message: TOO_LONG } } }

function setup(replies: readonly (() => Promise<BuildResult | null>)[]) {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const queue = [...replies]
  const rebuild = vi.fn(() => (queue.shift() ?? (async () => null))())
  renderHook(() => useGeometrySync(store, { rebuild } as unknown as GeometryClient))
  return { store, rebuild }
}

describe('useGeometrySync', () => {
  it("builds again when the worker got stuck on one of Kade's shapes, so only that part shows the problem", async () => {
    const { store, rebuild } = setup([() => Promise.reject(new GeometryTimeoutError(['loop'])), async () => tooLong])
    await waitFor(() => expect(store.getState().errors).toEqual({ robot: TOO_LONG }))
    expect(rebuild).toHaveBeenCalledTimes(2)
    expect(store.getState().notice).toBeNull()
  })
  it('shows the stuck notice when no shape of Kade\'s was to blame', async () => {
    const { store, rebuild } = setup([() => Promise.reject(new GeometryTimeoutError())])
    await waitFor(() => expect(store.getState().notice).toBe(new GeometryTimeoutError().message))
    expect(rebuild).toHaveBeenCalledTimes(1)
  })
  it('builds again only once for the same stuck shape', async () => {
    const stuck = () => Promise.reject(new GeometryTimeoutError(['loop']))
    const { store, rebuild } = setup([stuck, stuck])
    await waitFor(() => expect(store.getState().notice).toBe(new GeometryTimeoutError().message))
    expect(rebuild).toHaveBeenCalledTimes(2)
  })
})
