import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { createCadToolkit } from '../cad'
import { registry } from '../index'
import { defaultParams } from '../params'
import { quarterEllipse } from './shape-profile'

beforeAll(initTestOC)

const buildDefault = (id: string) => {
  const plugin = registry.get(id)
  if (!plugin) throw new Error(`missing ${id}`)
  return plugin.build(defaultParams(plugin), createCadToolkit())
}

describe('quarterEllipse', () => {
  it('runs up from the right edge to the top by default', () => {
    const { curve } = quarterEllipse(1, 2, 10, 5)
    expect(curve[2]).toEqual([1, 7])
    expect(curve[0][0]).toBeCloseTo(11, 9)
    expect(curve[0][1]).toBeGreaterThan(2)
    expect(curve[1][1]).toBeCloseTo(7, 9)
  })

  it('runs back down to the right edge with towardTop false', () => {
    const { curve } = quarterEllipse(1, 2, 10, 5, false)
    expect(curve[2]).toEqual([11, 2])
    expect(curve[0][0]).toBeGreaterThan(1)
    expect(curve[0][1]).toBeCloseTo(7, 9)
    expect(curve[1][0]).toBeCloseTo(11, 9)
    expect(curve[1][1]).toBeGreaterThan(2)
  })

  it('goes left with a negative rx', () => {
    expect(quarterEllipse(0, 0, -10, 5).curve[0][0]).toBeCloseTo(-10, 9)
    expect(quarterEllipse(0, 0, -10, 5, false).curve[2]).toEqual([-10, 0])
  })
})

describe('roofs and pyramid', () => {
  it('builds the roof, a triangle prism', () => {
    expect(measureVolume(buildDefault('roof'))).toBeCloseTo(4000, 1)
  })

  it('builds the round roof as half an ellipse', () => {
    const expected = (Math.PI * 10 * 10) / 2 * 20
    expect(Math.abs(measureVolume(buildDefault('round-roof')) - expected) / expected).toBeLessThan(0.005)
  })

  it('builds the pyramid as a third of its box', () => {
    expect(measureVolume(buildDefault('pyramid'))).toBeCloseTo(8000 / 3, 1)
  })

  it.each([['roof', 20], ['round-roof', 10], ['pyramid', 20]])('%s sits centred on the plate', (id, height) => {
    const [[x0, y0, z0], [x1, y1, z1]] = buildDefault(id).boundingBox.bounds
    const got = [x0, y0, z0, x1, y1, z1]
    const want = [-10, -10, 0, 10, 10, height]
    want.forEach((value, i) => expect(got[i]).toBeCloseTo(value, 3))
  })
})

describe('tube, half sphere and paraboloid', () => {
  const within = (actual: number, expected: number) =>
    expect(Math.abs(actual - expected) / expected).toBeLessThan(0.005)

  it('builds the tube as a cylinder minus its hole', () => {
    expect(measureVolume(buildDefault('tube'))).toBeCloseTo(Math.PI * (100 - 64) * 20, 1)
  })

  it('builds the half sphere as half a ball', () => {
    within(measureVolume(buildDefault('half-sphere')), (2 / 3) * Math.PI * 100 * 10)
  })

  it('builds the paraboloid as half of its cylinder', () => {
    within(measureVolume(buildDefault('paraboloid')), (Math.PI * 100 * 20) / 2)
  })

  it.each([['tube', 20], ['half-sphere', 10], ['paraboloid', 20]])('%s sits centred on the plate', (id, height) => {
    const [[x0, y0, z0], [x1, y1, z1]] = buildDefault(id).boundingBox.bounds
    const got = [x0, y0, z0, x1, y1, z1]
    const want = [-10, -10, 0, 10, 10, height]
    want.forEach((value, i) => expect(got[i]).toBeCloseTo(value, 3))
  })

  const buildTube = (wall: number) => {
    const plugin = registry.get('tube')
    if (!plugin) throw new Error('missing tube')
    return plugin.build({ ...defaultParams(plugin), wall }, createCadToolkit())
  }

  it('refuses a wall that fills the tube', () => {
    expect(() => buildTube(10)).toThrow('The wall is too thick for this tube. Make it less than 10 mm.')
  })

  it('builds the thinnest wall', () => {
    expect(measureVolume(buildTube(0.4))).toBeGreaterThan(0)
  })
})
