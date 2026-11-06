import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { NOT_STL } from '../import/limits'
import { GAPS_MESSAGE, UNEXPECTED_MESSAGE } from './constants'
import { loadManifold } from './manifold'
import { openModel } from './model'
import { plateStl, triangleCountOf, withoutTriangle } from './test-meshes'

let wasm: ManifoldToplevel
beforeAll(async () => { wasm = await loadManifold() })

describe('openModel', () => {
  it('opens a plate at full detail', () => {
    const file = plateStl({ width: 254, depth: 305, base: 6.4, raised: [{ x: [-20, 20], y: [-40, 40], height: 5 }] })
    const result = openModel(wasm, file, 'mm')
    if (!result.ok) throw new Error(result.message)
    const { solid, info } = result.value
    expect(info.size[0]).toBeCloseTo(254, 3)
    expect(info.size[1]).toBeCloseTo(305, 3)
    expect(info.size[2]).toBeCloseTo(11.4, 3)
    expect(info.triangleCount).toBe(triangleCountOf(file))
    const box = solid.boundingBox()
    expect(box.min[0]).toBeCloseTo(-127, 3)
    expect(box.max[0]).toBeCloseTo(127, 3)
    expect(box.min[1]).toBeCloseTo(-152.5, 3)
    expect(box.max[1]).toBeCloseTo(152.5, 3)
    expect(box.min[2]).toBeCloseTo(0, 3)
    solid.delete()
  })

  it('scales an inch file', () => {
    const result = openModel(wasm, plateStl({ width: 10, depth: 12, base: 0.25 }), 'inches')
    if (!result.ok) throw new Error(result.message)
    expect(result.value.info.size[0]).toBeCloseTo(254, 2)
    expect(result.value.info.size[1]).toBeCloseTo(304.8, 2)
    expect(result.value.info.size[2]).toBeCloseTo(6.35, 2)
    result.value.solid.delete()
  })

  it('refuses a model with gaps', () => {
    const file = withoutTriangle(plateStl({ width: 50, depth: 50, base: 5 }), 3)
    expect(openModel(wasm, file, 'mm')).toEqual({ ok: false, message: GAPS_MESSAGE })
  })

  it("refuses a file that isn't an STL", () => {
    const junk = new TextEncoder().encode('hello there').buffer
    expect(openModel(wasm, junk, 'mm')).toEqual({ ok: false, message: NOT_STL })
  })
})

/** A stand-in for Manifold whose ofMesh does what the test says. */
function fakeWasm(ofMesh: () => unknown): ManifoldToplevel {
  return { Mesh: class { merge(): boolean { return true } }, Manifold: { ofMesh } } as unknown as ManifoldToplevel
}

const notManifold = (): never => { throw Object.assign(new Error('Not manifold'), { name: 'ManifoldError', code: 'NotManifold' }) }

describe('openModel when something unexpected goes wrong', () => {
  const file = (): ArrayBuffer => plateStl({ width: 50, depth: 50, base: 5 })
  afterEach(() => vi.restoreAllMocks())

  it('gives the gaps message only for a surface that is not closed', () => {
    expect(openModel(fakeWasm(notManifold), file(), 'mm')).toEqual({ ok: false, message: GAPS_MESSAGE })
  })

  it('gives the unexpected message (and logs it) for any other Manifold failure', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const tooLarge = (): never => { throw Object.assign(new Error('Result exceeds maximum size'), { name: 'ManifoldError', code: 'ResultTooLarge' }) }
    expect(openModel(fakeWasm(tooLarge), file(), 'mm')).toEqual({ ok: false, message: UNEXPECTED_MESSAGE })
    expect(log).toHaveBeenCalled()
  })

  it('gives the unexpected message (and logs it), not "not an STL", when a later step fails', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken = { status: () => 'NoError', isEmpty: () => false, boundingBox: () => { throw new Error('boom') }, delete: () => undefined }
    expect(openModel(fakeWasm(() => broken), file(), 'mm')).toEqual({ ok: false, message: UNEXPECTED_MESSAGE })
    expect(log).toHaveBeenCalled()
  })
})
