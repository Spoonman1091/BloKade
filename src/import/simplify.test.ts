import { describe, expect, it } from 'vitest'
import { cubeLattice, type TestMesh } from '../geometry/testing/meshes'
import { TOO_DETAILED } from './limits'
import { simplifyMesh } from './simplify'
import { StlError } from './stl'

const run = (mesh: TestMesh, max: number) => simplifyMesh(new Float32Array(mesh.vertices), new Uint32Array(mesh.triangles), max)

describe('simplifyMesh', () => {
  it('keeps trying rougher settings until the model is under the target', async () => {
    // 1,000 separate cubes: plain simplifying cannot merge them and the first rough pass leaves 12,000 triangles.
    const result = await run(cubeLattice(10, 1.8, 2), 500)
    expect(result.triangles.length / 3).toBeLessThanOrEqual(500)
    expect(result.triangles.length).toBeGreaterThan(0)
  })

  it('refuses a model it cannot bring under the target', async () => {
    const failure = await run(cubeLattice(8, 1.8, 2), 1000).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(StlError)
    expect((failure as StlError).message).toBe(TOO_DETAILED)
  })

  it('leaves no vertex unused', async () => {
    const result = await run(cubeLattice(10, 1.8, 2), 500)
    const used = new Set(result.triangles)
    expect(used.size).toBe(result.vertices.length / 3)
  })
})
