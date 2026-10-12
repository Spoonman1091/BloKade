import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { buildKadeCode } from '../testing/build-code'
import { GEAR_CODE } from './gear'

beforeAll(initTestOC)

describe('the Gear example', () => {
  it('has the four settings and size handles', async () => {
    const gear = await buildKadeCode(GEAR_CODE)
    expect(gear.meta.name).toBe('Gear')
    expect(Object.keys(gear.meta.params)).toEqual(['teeth', 'size', 'thickness', 'hole'])
    expect(gear.meta.size).toEqual({ x: 'size', y: 'size', z: 'thickness' })
    const [min, max] = gear.shape.boundingBox.bounds
    expect(max?.[0]).toBeCloseTo(20, 0)
    expect(min?.[0]).toBeCloseTo(-20, 0)
    expect(max?.[2]).toBeCloseTo(6, 1)
    gear.dispose()
  })
  it('builds with other settings', async () => {
    const gear = await buildKadeCode(GEAR_CODE, { teeth: 6, size: 60, thickness: 3, hole: 8 })
    expect(gear.shape.boundingBox.bounds[1]?.[2]).toBeCloseTo(3, 1)
    gear.dispose()
  })
})
