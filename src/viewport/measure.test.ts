import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import { formatMeasurement, measure } from './measure'

const target: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const named = (name: string, minX: number) => ({ id: name, name, box: { min: [minX, -10, 0], max: [minX + 20, 10, 20] } as Box })

describe('measurements', () => {
  it('reports size and the nearest part', () => {
    const m = measure(target, [named('Far', 100), named('Cylinder', 15.5)])
    expect(m).toEqual({ size: [20, 20, 20], nearest: { name: 'Cylinder', distance: 5.5 } })
    expect(formatMeasurement(m)).toBe('20 × 20 × 20 mm · 5.5 mm from Cylinder')
  })

  it('says touching when parts meet, and just the size when alone', () => {
    expect(formatMeasurement(measure(target, [named('Box', 10)]))).toBe('20 × 20 × 20 mm · touching Box')
    expect(formatMeasurement(measure(target, []))).toBe('20 × 20 × 20 mm')
  })
})
