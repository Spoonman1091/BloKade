import { describe, expect, it } from 'vitest'
import { cubeMesh, openCubeMesh, sphereMesh } from '../geometry/testing/meshes'
import { MAX_STL_BYTES, NO_TRIANGLES, NOT_STL, TOO_BIG_FILE } from './limits'
import { prepareStl } from './prepare'
import { binaryStl, shifted } from './testing/stl-files'

describe('prepareStl', () => {
  it('welds, centres and measures a model', async () => {
    const result = await prepareStl(binaryStl(shifted(cubeMesh(10), [100, 50, 7])))
    expect(result).toMatchObject({ ok: true, model: { size: [10, 10, 10], triangleCount: 12, simplified: false, hasGaps: false } })
    if (!result.ok) throw new Error('expected ok')
    const v = result.model.vertices
    const axis = (k: number) => Array.from({ length: v.length / 3 }, (_, i) => v[i * 3 + k] ?? 0)
    expect(v.length / 3).toBe(8)
    expect([Math.min(...axis(0)), Math.max(...axis(0))]).toEqual([-5, 5])
    expect([Math.min(...axis(1)), Math.max(...axis(1))]).toEqual([-5, 5])
    expect(Math.min(...axis(2))).toBe(0)
  })
  it('notices gaps', async () => {
    expect(await prepareStl(binaryStl(openCubeMesh(10)))).toMatchObject({ ok: true, model: { hasGaps: true } })
  })
  it('simplifies a detailed model to the limit', async () => {
    const result = await prepareStl(binaryStl(sphereMesh(40, 128, 64)), 2000)
    expect(result.ok && result.model.simplified).toBe(true)
    expect(result.ok && result.model.triangleCount).toBeLessThanOrEqual(2000)
  })
  it('turns a bad file into a message', async () => {
    expect(await prepareStl(new ArrayBuffer(10))).toEqual({ ok: false, message: NOT_STL })
  })
  it('refuses a file over 50 MB without reading it', async () => {
    expect(await prepareStl(new ArrayBuffer(MAX_STL_BYTES + 1))).toEqual({ ok: false, message: TOO_BIG_FILE })
  })
})

describe('prepareStl edge cases', () => {
  it('refuses a file of only collapsed triangles', async () => {
    const flat = { vertices: [1, 1, 1], triangles: [0, 0, 0] }
    expect(await prepareStl(binaryStl(flat))).toEqual({ ok: false, message: NO_TRIANGLES })
  })
})

describe.skipIf(!process.env.BLOKADE_TIMING)('prepareStl timing', () => {
  it('prepares about a million triangles', async () => {
    const file = binaryStl(sphereMesh(100, 708, 708))
    const start = performance.now()
    const result = await prepareStl(file)
    console.info(`prepareStl ~1M triangles: ${Math.round(performance.now() - start)} ms, triangleCount ${result.ok ? result.model.triangleCount : result.message}`)
    expect(result.ok).toBe(true)
  }, 120000)
})
