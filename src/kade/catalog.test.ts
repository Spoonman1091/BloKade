import { describe, expect, it, vi } from 'vitest'
import { GeometryTimeoutError } from '../geometry/client'
import { createShapeCatalog, namesFromChecks, resultFor } from './catalog'
import { codeHash } from './hash'
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
  it('checks again after a failure that is not a timeout', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const inspect = vi.fn<(code: string) => Promise<InspectResult>>()
      .mockRejectedValueOnce(new Error('worker gone')).mockResolvedValueOnce(good)
    const catalog = createShapeCatalog(inspect)
    catalog.getState().request('x')
    await flush()
    catalog.getState().request('x')
    await flush()
    expect(inspect).toHaveBeenCalledTimes(2)
    expect(resultFor(catalog.getState().results, 'x')).toEqual(good)
    error.mockRestore()
  })
  it('remembers a timeout and does not ask again', async () => {
    const inspect = vi.fn(async (): Promise<InspectResult> => { throw new GeometryTimeoutError() })
    const catalog = createShapeCatalog(inspect)
    catalog.getState().request('loop')
    await flush()
    catalog.getState().request('loop')
    expect(inspect).toHaveBeenCalledOnce()
  })
  it('survives a check that throws at once', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const catalog = createShapeCatalog(() => { throw new Error('sync') })
    expect(() => catalog.getState().request('y')).not.toThrow()
    await flush()
    expect(resultFor(catalog.getState().results, 'y')).toEqual({ ok: false, problem: CHECK_FAILED })
    error.mockRestore()
  })
})

describe('namesFromChecks', () => {
  it("takes each library shape's name from its checked code", () => {
    const library = [
      { id: 'my-a', name: 'Old', code: 'a', updatedAt: 1 },
      { id: 'my-b', name: 'B', code: 'b', updatedAt: 1 },
      { id: 'my-c', name: 'C', code: 'c', updatedAt: 1 },
    ]
    const results = {
      [codeHash('a')]: { ok: true, meta: { name: 'Rocket', icon: '🚀', params: {} } },
      [codeHash('b')]: { ok: false, problem: 'x' },
    } as const
    expect(namesFromChecks(library, results)).toEqual({ 'my-a': 'Rocket' })
  })
})
