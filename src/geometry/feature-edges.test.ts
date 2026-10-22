import { describe, expect, it } from 'vitest'
import { featureEdges } from './feature-edges'
import { cubeMesh, sphereMesh, type TestMesh } from './testing/meshes'

const flat = (mesh: TestMesh): [Float32Array, Uint32Array] => [new Float32Array(mesh.vertices), new Uint32Array(mesh.triangles)]
const squareMesh = (): TestMesh => ({ vertices: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], triangles: [0, 1, 2, 0, 2, 3] })

describe('featureEdges', () => {
  it('draws the 12 edges of a cube', () => expect(featureEdges(...flat(cubeMesh(10))).length).toBe(12 * 6))
  it('hides the diagonal of a flat square', () => expect(featureEdges(...flat(squareMesh())).length).toBe(4 * 6))
  it('hides the edges of a smooth sphere', () => {
    expect(featureEdges(...flat(sphereMesh(40, 32, 16))).length).toBe(0)
  })
  it('sees edges between faces whose corners are repeated per face', () => {
    const cube = cubeMesh(10)
    const repeated = cube.triangles.flatMap((corner) => cube.vertices.slice(corner * 3, corner * 3 + 3))
    const mesh = { vertices: repeated, triangles: repeated.map((_, i) => i).filter((i) => i % 3 === 0).map((i) => i / 3) }
    expect(featureEdges(...flat(mesh)).length).toBe(12 * 6)
  })
})
