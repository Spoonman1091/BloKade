import { describe, expect, it } from 'vitest'
import { countOpenEdges, weldMesh } from './weld'

// Two triangles of a square, with the shared corner duplicated (as STL/face meshes do).
const vertices = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]
const triangles = [0, 1, 2, 3, 4, 5]

describe('weldMesh', () => {
  it('merges duplicate vertices', () => {
    const welded = weldMesh(vertices, triangles)
    expect(welded.vertices).toHaveLength(12)
    expect(welded.triangles).toEqual([0, 1, 2, 0, 2, 3])
  })

  it('drops triangles that collapse to a line', () => {
    expect(weldMesh([0, 0, 0, 0, 0, 0, 1, 0, 0], [0, 1, 2]).triangles).toEqual([])
  })
})

describe('countOpenEdges', () => {
  it('counts edges not shared by exactly two triangles', () => {
    expect(countOpenEdges(weldMesh(vertices, triangles).triangles)).toBe(4)
  })

  it('finds a closed tetrahedron watertight', () => {
    expect(countOpenEdges([0, 1, 2, 0, 3, 1, 1, 3, 2, 2, 3, 0])).toBe(0)
  })
})
