import { describe, expect, it } from 'vitest'
import { boxCenter, boxEdge, boxGap, boxSize, translateBox, unionBox, type Box } from './box'

const a: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const b: Box = { min: [15, -10, 0], max: [35, 10, 20] }

describe('box math', () => {
  it('measures size, center and edges', () => {
    expect(boxSize(a)).toEqual([20, 20, 20])
    expect(boxCenter(b)).toEqual([25, 0, 10])
    expect(boxEdge(b, 0, 'min')).toBe(15)
    expect(boxEdge(b, 0, 'center')).toBe(25)
    expect(boxEdge(b, 2, 'max')).toBe(20)
  })

  it('joins boxes', () => {
    expect(unionBox([a, b])).toEqual({ min: [-10, -10, 0], max: [35, 10, 20] })
    expect(unionBox([])).toBeNull()
  })

  it('moves a box', () => {
    expect(translateBox(a, [1, 2, 3])).toEqual({ min: [-9, -8, 3], max: [11, 12, 23] })
  })

  it('finds the gap between boxes, and zero when they touch or overlap', () => {
    expect(boxGap(a, b)).toBe(5)
    expect(boxGap(a, { min: [13, 14, 0], max: [20, 20, 1] })).toBe(5)
    expect(boxGap(a, translateBox(a, [5, 0, 0]))).toBe(0)
  })
})
