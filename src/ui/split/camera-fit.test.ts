import { describe, expect, it } from 'vitest'
import { cameraFit } from './camera-fit'

const FOV = 45
const length = (v: readonly number[]): number => Math.hypot(...v)

describe('cameraFit', () => {
  it('backs off far enough to see the whole 254 x 305 model, along the usual view direction', () => {
    const { position, target } = cameraFit({ width: 254, depth: 305 }, { width: 180, depth: 180 }, FOV, 1.5)
    expect(target).toEqual([0, 0, 0])
    const expected = (1.3 * 305) / (2 * Math.tan((FOV / 2) * (Math.PI / 180)))
    expect(length(position)).toBeCloseTo(expected, 3)
    const [x, y, z] = position.map((p) => p / length(position))
    const base = length([120, -160, 120])
    expect([x, y, z]).toEqual([120 / base, -160 / base, 120 / base].map((n) => expect.closeTo(n, 6)))
  })

  it('frames the plate when the plate is bigger than the model', () => {
    const small = cameraFit({ width: 50, depth: 40 }, { width: 256, depth: 256 }, FOV, 1.5)
    const big = cameraFit({ width: 256, depth: 256 }, null, FOV, 1.5)
    expect(length(small.position)).toBeCloseTo(length(big.position), 6)
  })

  it('backs off further in a tall, narrow view', () => {
    const wide = cameraFit({ width: 254, depth: 305 }, null, FOV, 1.5)
    const narrow = cameraFit({ width: 254, depth: 305 }, null, FOV, 0.5)
    expect(length(narrow.position)).toBeGreaterThan(length(wide.position))
  })

  it('still gives a sensible view with nothing open and no printer', () => {
    expect(length(cameraFit(null, null, FOV, 1).position)).toBeGreaterThan(100)
  })
})
