import { describe, expect, it, vi } from 'vitest'
import { GeometryTimeoutError } from '../geometry/client'
import { createShapeCatalog, resultFor } from './catalog'
import { CHECK_FAILED, TOO_LONG } from './messages'
import type { InspectResult } from './meta'

const flush = () => new Promise((r) => setTimeout(r, 0))
const good: InspectResult = { ok: true, meta: { name: 'Gear', icon: '⚙️', params: {} } }

describe('the shape catalog', () => {
  it('asks the worker about each code once and keeps the answer', async () => {
    const inspect = vi.fn(async () => good)
    const catalog = createShapeCatalog(inspect)
    catalog.getState().request('code one')
    catalog.getState().request('code one')
    await flush()
    catalog.getState().request('code one')
    expect(inspect).toHaveBeenCalledOnce()
    expect(resultFor(catalog.getState().results, 'code one')).toEqual(good)
    expect(resultFor(catalog.getState().results, 'other code')).toBeUndefined()
  })
  it('says a shape took too long when the worker had to restart', async () => {
    const catalog = createShapeCatalog(async () => { throw new GeometryTimeoutError() })
    catalog.getState().request('while (true) {}')
    await flush()
    expect(resultFor(catalog.getState().results, 'while (true) {}')).toEqual({ ok: false, problem: TOO_LONG })
  })
  it('reports any other failure in plain words', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const catalog = createShapeCatalog(async () => { throw new Error('worker gone') })
    catalog.getState().request('x')
    await flush()
    expect(resultFor(catalog.getState().results, 'x')).toEqual({ ok: false, problem: CHECK_FAILED })
    error.mockRestore()
  })
})
