import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import type { Vec3 } from '../document/types'
import {
  fingerprintOf, fingerprintScore, matchesDescription, matchFingerprints, MATCH_THRESHOLD, selectedEdges, type EdgeInfo,
} from './edge-select'

/** A straight edge from a to b, sampled like edge-info.ts does. */
function line(a: Vec3, b: Vec3): EdgeInfo {
  const at = (t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  return { kind: 'line', samples: [0, 0.25, 0.5, 0.75, 1].map(at), tangent: [(b[0] - a[0]) / length, (b[1] - a[1]) / length, (b[2] - a[2]) / length], length }
}

/** The 12 edges of an axis-aligned box from min to max. */
function cubeEdges(min: Vec3, max: Vec3): EdgeInfo[] {
  const [x0, y0, z0] = min
  const [x1, y1, z1] = max
  const ring = (z: number): EdgeInfo[] => [
    line([x0, y0, z], [x1, y0, z]), line([x1, y0, z], [x1, y1, z]), line([x1, y1, z], [x0, y1, z]), line([x0, y1, z], [x0, y0, z]),
  ]
  const posts = [line([x0, y0, z0], [x0, y0, z1]), line([x1, y0, z0], [x1, y0, z1]), line([x1, y1, z0], [x1, y1, z1]), line([x0, y1, z0], [x0, y1, z1])]
  return [...ring(z0), ...ring(z1), ...posts]
}

const cubeBox: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const cube = cubeEdges(cubeBox.min, cubeBox.max)
const indices = (set: ReadonlySet<number>) => [...set].sort((a, b) => a - b)

describe('edges by description', () => {
  it('finds top, bottom, upright and flat edges of a box', () => {
    const which = (w: 'top' | 'bottom' | 'vertical' | 'horizontal' | 'all') =>
      indices(selectedEdges({ by: 'description', which: w }, cube, cubeBox).indices)
    expect(which('bottom')).toEqual([0, 1, 2, 3])
    expect(which('top')).toEqual([4, 5, 6, 7])
    expect(which('vertical')).toEqual([8, 9, 10, 11])
    expect(which('horizontal')).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(which('all')).toHaveLength(12)
  })

  it('treats a circle lying on the top as a top edge', () => {
    const circle: EdgeInfo = {
      kind: 'circle', samples: [[5, 0, 20], [0, 5, 20], [-5, 0, 20], [0, -5, 20], [5, 0, 20]], tangent: [-1, 0, 0], length: 31.4,
    }
    expect(matchesDescription(circle, 'top', cubeBox)).toBe(true)
    expect(matchesDescription(circle, 'vertical', cubeBox)).toBe(false)
  })

  it('never chooses collapsed edges, like the poles of a sphere', () => {
    const pole: EdgeInfo = { kind: 'other', samples: Array.from({ length: 5 }, (): Vec3 => [0, 0, 20]), tangent: [0, 0, 0], length: 0 }
    expect(matchesDescription(pole, 'top', cubeBox)).toBe(false)
    expect(matchesDescription(pole, 'all', cubeBox)).toBe(false)
  })
})

describe('edge fingerprints (Review Focus 3)', () => {
  it('records position relative to the box, with a tidy direction', () => {
    const top = cube[4]
    if (!top) throw new Error('missing edge')
    expect(fingerprintOf(top, cubeBox)).toEqual({ kind: 'line', mid: [0.5, 0, 1], dir: [1, 0, 0], length: 0.5774 })
    const reversed = line([10, -10, 20], [-10, -10, 20])
    expect(fingerprintOf(reversed, cubeBox).dir).toEqual([1, 0, 0])
  })

  it('finds the same edges after the part is resized', () => {
    const picked = [cube[4], cube[6]].map((e) => fingerprintOf(e as EdgeInfo, cubeBox))
    const bigBox: Box = { min: [-20, -10, 0], max: [20, 10, 10] }
    const result = matchFingerprints(picked, cubeEdges(bigBox.min, bigBox.max), bigBox)
    expect(indices(result.matched)).toEqual([4, 6])
    expect(result.lost).toBe(0)
  })

  it('still matches after a uniform resize', () => {
    const picked = [cube[4], cube[6]].map((e) => fingerprintOf(e as EdgeInfo, cubeBox))
    const doubled: Box = { min: [-20, -20, 0], max: [20, 20, 40] }
    const result = matchFingerprints(picked, cubeEdges(doubled.min, doubled.max), doubled)
    expect(indices(result.matched)).toEqual([4, 6])
    expect(result.lost).toBe(0)
  })

  it('picked selection returns matched indices and the lost count', () => {
    const picked = [cube[4], cube[6]].map((e) => fingerprintOf(e as EdgeInfo, cubeBox))
    const found = selectedEdges({ by: 'picked', fingerprints: picked }, cube, cubeBox)
    expect(indices(found.indices)).toEqual([4, 6])
    expect(found.lost).toBe(0)
    const gone = selectedEdges({ by: 'picked', fingerprints: picked }, [], cubeBox)
    expect(gone).toEqual({ indices: new Set(), lost: 2 })
  })

  it('reports edges that are gone and never matches one edge twice', () => {
    const picked = [cube[4], cube[4]].map((e) => fingerprintOf(e as EdgeInfo, cubeBox))
    expect(matchFingerprints(picked, cube, cubeBox)).toEqual({ matched: new Set([4]), lost: 1 })
    expect(matchFingerprints(picked, [], cubeBox).lost).toBe(2)
  })

  it('never matches edges of a different kind or far away', () => {
    const fp = fingerprintOf(cube[4] as EdgeInfo, cubeBox)
    expect(fingerprintScore(fp, { ...fp, kind: 'circle' })).toBe(Number.POSITIVE_INFINITY)
    expect(fingerprintScore(fp, { ...fp, mid: [0.5, 1, 1] })).toBeGreaterThan(MATCH_THRESHOLD)
  })

  it('handles flat parts without dividing by zero', () => {
    const flat: Box = { min: [0, 0, 0], max: [10, 10, 0] }
    const fp = fingerprintOf(line([0, 0, 0], [10, 0, 0]), flat)
    expect(fp.mid).toEqual([0.5, 0, 0.5])
  })
})
