import { describe, expect, it } from 'vitest'
import { pointsOf } from './edge-points'

describe('pointsOf', () => {
  it('groups flat numbers into points and drops a trailing partial point', () => {
    expect(pointsOf([0, 0, 0, 1, 2, 3])).toEqual([[0, 0, 0], [1, 2, 3]])
    expect(pointsOf([0, 0, 0, 1, 2])).toEqual([[0, 0, 0]])
    expect(pointsOf([])).toEqual([])
  })
})
