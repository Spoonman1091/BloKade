import { describe, expect, it } from 'vitest'
import { edgeHitTolerance, isEdgeHitVisible, pointsOf } from './edge-points'

describe('pointsOf', () => {
  it('groups flat numbers into points and drops a trailing partial point', () => {
    expect(pointsOf([0, 0, 0, 1, 2, 3])).toEqual([[0, 0, 0], [1, 2, 3]])
    expect(pointsOf([0, 0, 0, 1, 2])).toEqual([[0, 0, 0]])
    expect(pointsOf([])).toEqual([])
  })
})

describe('isEdgeHitVisible', () => {
  it('accepts an edge with nothing in front of it', () => {
    expect(isEdgeHitVisible(100, [], 0.5)).toBe(true)
    expect(isEdgeHitVisible(100, [150], 0.5)).toBe(true)
  })

  it('accepts an edge lying on the surface that was hit', () => {
    expect(isEdgeHitVisible(100, [99.8], 0.5)).toBe(true)
  })

  it('ignores an edge hidden behind a face', () => {
    expect(isEdgeHitVisible(120, [150, 100], 0.5)).toBe(false)
  })
})

describe('edgeHitTolerance', () => {
  it('is half a millimetre up close and grows with distance', () => {
    expect(edgeHitTolerance(10)).toBe(0.5)
    expect(edgeHitTolerance(1000)).toBe(10)
  })
})
