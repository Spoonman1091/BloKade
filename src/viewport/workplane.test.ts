import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { transformToMatrix } from '../document/transform-math'
import { workplaneFromHit } from './workplane'

describe('workplaneFromHit', () => {
  it('keeps an upward face flat and rounds the point to 0.01 mm', () => {
    expect(workplaneFromHit([1.234, 5, 20], [0, 0, 1])).toEqual({ origin: [1.23, 5, 20], rotation: [0, 0, 0] })
  })

  it.each([[1, 0, 0], [0, -1, 0], [0, 0, -1], [1, 1, 0], [0, 3, 4]])('stands new shapes on a face facing %d %d %d', (x, y, z) => {
    const { rotation } = workplaneFromHit([0, 0, 0], [x, y, z])
    const up = new Vector3(0, 0, 1).transformDirection(transformToMatrix({ position: [0, 0, 0], rotation }))
    expect(up.distanceTo(new Vector3(x, y, z).normalize())).toBeLessThan(1e-3)
  })

  it('falls back to flat for a broken normal', () => {
    expect(workplaneFromHit([0, 0, 0], [0, 0, 0]).rotation).toEqual([0, 0, 0])
  })
})
