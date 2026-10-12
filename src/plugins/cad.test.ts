import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { cleanProfile, createCadToolkit } from './cad'

beforeAll(initTestOC)

const boundsOf = (shape: { boundingBox: { bounds: [number[], number[]] } }) =>
  shape.boundingBox.bounds.map((p) => p.map((v) => Math.round(v * 1000) / 1000))

describe('cleanProfile', () => {
  it('removes repeated and closing points', () => {
    expect(cleanProfile([[0, 0], [1, 0], [1, 0], [0, 1], [0, 0]])).toEqual([[0, 0], [1, 0], [0, 1]])
  })
})

describe('cad toolkit', () => {
  const cad = createCadToolkit()

  it('makes a box resting on the ground', () => {
    const box = cad.box(10, 20, 30)
    expect(measureVolume(box)).toBeCloseTo(6000, 3)
    expect(boundsOf(box)).toEqual([[-5, -10, 0], [5, 10, 30]])
  })

  it('makes a cylinder from a diameter', () => {
    expect(measureVolume(cad.cylinder(10, 10))).toBeCloseTo(Math.PI * 25 * 10, 3)
  })

  it('makes a sphere resting on the ground', () => {
    expect(boundsOf(cad.sphere(10))).toEqual([[-5, -5, 0], [5, 5, 10]])
  })

  it('revolves a profile around Z', () => {
    const cone = cad.revolve([[0, 0], [10, 0], [0, 20]])
    expect(measureVolume(cone)).toBeCloseTo((Math.PI * 100 * 20) / 3, 2)
  })

  it('refuses revolve profiles that cross the center line', () => {
    expect(() => cad.revolve([[-1, 0], [5, 0], [0, 5]])).toThrow('center line')
  })

  it('refuses profiles with fewer than 3 points', () => {
    expect(() => cad.revolve([[0, 0], [5, 0], [5, 0]])).toThrow('at least 3')
  })

  it('extrudes a side profile centered on Y', () => {
    const wedge = cad.extrudeSide([[-10, 0], [10, 0], [-10, 15]], 10)
    expect(measureVolume(wedge)).toBeCloseTo(1500, 3)
    expect(boundsOf(wedge)).toEqual([[-10, -5, 0], [10, 5, 15]])
  })

  it('makes a torus and refuses a closed-up ring', () => {
    expect(measureVolume(cad.torus(50, 10))).toBeCloseTo(2 * Math.PI ** 2 * 20 * 25, 1)
    expect(() => cad.torus(20, 10)).toThrow('wider than twice its thickness')
  })
})
