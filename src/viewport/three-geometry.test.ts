import { describe, expect, it } from 'vitest'
import type { MeshData } from '../geometry/types'
import { toBufferGeometry, toEdgeGeometry } from './three-geometry'

const triangle: MeshData = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2]),
  edges: new Float32Array([0, 0, 0, 1, 0, 0]),
}

describe('three geometry', () => {
  it('builds an indexed triangle mesh', () => {
    const g = toBufferGeometry(triangle)
    expect(g.getAttribute('position').count).toBe(3)
    expect(g.getAttribute('normal').count).toBe(3)
    expect(g.getIndex()?.count).toBe(3)
  })

  it('builds edge line segments', () => {
    expect(toEdgeGeometry(triangle).getAttribute('position').count).toBe(2)
  })
})
