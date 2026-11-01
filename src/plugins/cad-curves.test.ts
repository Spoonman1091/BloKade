import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { createCadToolkit } from './cad'

beforeAll(initTestOC)

const cad = createCadToolkit()
const K = 5.522847 // quarter-circle Bézier handle for radius 10

describe('curve steps in outlines', () => {
  it('revolves a quarter-ellipse curve into a dome', () => {
    const dome = cad.revolve([[0, 0], [10, 0], { curve: [[10, K], [K, 10], [0, 10]] }])
    const expected = (2 / 3) * Math.PI * 100 * 10
    expect(Math.abs(measureVolume(dome) - expected) / expected).toBeLessThan(0.005)
    expect(dome.boundingBox.bounds[1][2]).toBeCloseTo(10, 3)
  })

  it('pushes a curved outline up with prism', () => {
    const half = cad.prism(
      [[-10, 0], [10, 0], { curve: [[10, K], [K, 10], [0, 10]] }, { curve: [[-K, 10], [-10, K], [-10, 0]] }],
      2,
    )
    const expected = (Math.PI * 100) / 2 * 2
    expect(Math.abs(measureVolume(half) - expected) / expected).toBeLessThan(0.005)
  })

  it('rejects a curve that crosses the spin line', () => {
    expect(() => cad.revolve([[0, 0], [10, 0], { curve: [[10, K], [-1, 10], [0, 10]] }])).toThrow(
      'A spin outline must stay on the right of the center line (x ≥ 0).',
    )
  })

  it('still takes plain point outlines', () => {
    expect(measureVolume(cad.prism([[0, 0], [10, 0], [0, 10]], 1))).toBeCloseTo(50, 3)
  })
})
