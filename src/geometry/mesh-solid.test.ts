import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { createCadToolkit } from '../plugins/cad'
import { shapeBox } from './edge-info'
import { meshSolid } from './mesh-solid'
import { cubeMesh, sphereMesh } from './testing/meshes'
import { initTestOC } from './testing/oc-node'

describe('meshSolid', () => {
  beforeAll(initTestOC)

  it('turns a closed mesh into a solid of the right size', () => {
    const { vertices, triangles } = cubeMesh(10)
    const solid = meshSolid(vertices, triangles)
    expect(measureVolume(solid)).toBeCloseTo(1000, 3)
    const box = shapeBox(solid)
    ;[-5, -5, 0].forEach((v, i) => expect(box.min[i]).toBeCloseTo(v, 4))
    ;[5, 5, 10].forEach((v, i) => expect(box.max[i]).toBeCloseTo(v, 4))
  })

  it('can be cut by an ordinary shape', () => {
    const { vertices, triangles } = cubeMesh(20)
    const solid = meshSolid(vertices, triangles)
    const hole = createCadToolkit().cylinder(10, 40).translateZ(-10)
    expect(measureVolume(solid.cut(hole))).toBeCloseTo(8000 - Math.PI * 25 * 20, 0)
  })

  it('refuses an empty mesh', () => {
    expect(() => meshSolid([], [])).toThrow('This model has no shape in it.')
  })

  it('builds a closed sphere', () => {
    const { vertices, triangles } = sphereMesh(20, 32, 16)
    expect(triangles.length / 3).toBe(2 * 32 * 15)
    const volume = measureVolume(meshSolid(vertices, triangles))
    expect(volume).toBeGreaterThan(0.95 * ((4 / 3) * Math.PI * 1000))
    expect(volume).toBeLessThan((4 / 3) * Math.PI * 1000)
  })
})
