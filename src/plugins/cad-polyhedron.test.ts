import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { createCadToolkit } from './cad'
import type { Point3 } from './cad-types'

beforeAll(initTestOC)

const cad = createCadToolkit()

const POINTS: readonly Point3[] = [[0, 0, 0], [10, 0, 0], [0, 10, 0], [0, 0, 10]]
const TRIANGLES = [[0, 2, 1], [0, 1, 3], [1, 2, 3], [0, 3, 2]] as const

describe('polyhedron', () => {
  it('builds a tetrahedron', () => {
    expect(measureVolume(cad.polyhedron(POINTS, TRIANGLES))).toBeCloseTo(1000 / 6, 3)
  })

  it('turns an inside-out tetrahedron the right way', () => {
    const inside = TRIANGLES.map(([a, b, c]) => [a, c, b] as const)
    expect(measureVolume(cad.polyhedron(POINTS, inside))).toBeCloseTo(1000 / 6, 3)
  })

  it("explains triangles that don't close up", () => {
    const open = TRIANGLES.slice(0, -1)
    expect(() => cad.polyhedron(POINTS, open)).toThrow("Those triangles don't close up into a solid.")
  })
})
