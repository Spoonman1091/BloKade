import { makeBaseBox } from 'replicad'
import { Box3, Vector3 } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { transformToMatrix } from '../document/transform-math'
import type { Transform } from '../document/types'
import { initTestOC } from './testing/oc-node'
import { placeShape } from './transform'

beforeAll(initTestOC)

describe('placeShape', () => {
  it('matches the three.js placement used by the viewport', () => {
    const t: Transform = { position: [5, -3, 2], rotation: [30, 45, 60] }
    const placed = placeShape(makeBaseBox(10, 20, 30), t)
    const corners = [-5, 5].flatMap((x) => [-10, 10].flatMap((y) => [0, 30].map((z) => new Vector3(x, y, z))))
    const expected = new Box3().setFromPoints(corners.map((c) => c.applyMatrix4(transformToMatrix(t))))
    const [min, max] = placed.boundingBox.bounds
    expect(min[0]).toBeCloseTo(expected.min.x, 2)
    expect(min[1]).toBeCloseTo(expected.min.y, 2)
    expect(min[2]).toBeCloseTo(expected.min.z, 2)
    expect(max[0]).toBeCloseTo(expected.max.x, 2)
    expect(max[1]).toBeCloseTo(expected.max.y, 2)
    expect(max[2]).toBeCloseTo(expected.max.z, 2)
  })
})
