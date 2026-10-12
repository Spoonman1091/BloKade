import { describe, expect, it } from 'vitest'
import { SCREWS } from '../fit-sizes'
import { hexOutline, screwHoleProfile } from './screw-profile'

const m3 = SCREWS.M3

describe('screwHoleProfile', () => {
  it('makes a plain hole enlarged by the extra room', () => {
    expect(screwHoleProfile(m3, 'plain', 10, 0.2)).toEqual([[0, 0], [1.7, 0], [1.7, 10], [0, 10]])
  })

  it('cuts a 90° countersink at the top', () => {
    const profile = screwHoleProfile(m3, 'countersunk', 10, 0.2)
    expect(profile).toHaveLength(5)
    expect(profile[2]?.[0]).toBeCloseTo(1.7, 6)
    expect(profile[2]?.[1]).toBeCloseTo(10 - (3.56 - 1.7), 6)
    expect(profile[3]?.[0]).toBeCloseTo(3.56, 6)
  })

  it('cuts a counterbore for the cap head at the top', () => {
    expect(screwHoleProfile(m3, 'counterbored', 10, 0.2)).toEqual([[0, 0], [1.7, 0], [1.7, 6.8], [2.95, 6.8], [2.95, 10], [0, 10]])
  })

  it('uses the exact insert size, without extra room', () => {
    expect(screwHoleProfile(m3, 'insert', 10, 0.2)).toEqual([[0, 0], [1.7, 0], [1.7, 4.3], [2, 4.3], [2, 10], [0, 10]])
  })

  it('refuses holes too shallow for the head, nut or insert (Review Focus 3)', () => {
    expect(() => screwHoleProfile(m3, 'countersunk', 2, 0.2)).toThrow('Make the hole deeper than 2.86 mm so the screw head fits.')
    expect(() => screwHoleProfile(m3, 'counterbored', 4, 0.2)).toThrow('Make the hole deeper than 4.2 mm so the screw head fits.')
    expect(() => screwHoleProfile(m3, 'insert', 6, 0.2)).toThrow('Make the hole deeper than 6.7 mm so the insert fits.')
    expect(() => screwHoleProfile(m3, 'nut', 3, 0.2)).toThrow('Make the hole deeper than 3.6 mm so the nut fits.')
  })
})

describe('hexOutline', () => {
  it('makes a hexagon with the given size across its flats', () => {
    const points = hexOutline(5.5)
    expect(points).toHaveLength(6)
    const ys = points.map(([, y]) => y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(5.5, 6)
  })
})
