import { beforeAll, describe, expect, it } from 'vitest'
import type { CrossSection, ManifoldToplevel } from 'manifold-3d'
import { DIGIT_HEIGHT } from './constants'
import { digitOutline } from './digits'
import { loadManifold } from './manifold'

let wasm: ManifoldToplevel
beforeAll(async () => { wasm = await loadManifold() })

/** Runs `read` on the outline for n, then frees it. */
function measure<T>(n: number, read: (outline: CrossSection) => T): T {
  const outline = digitOutline(wasm, n, DIGIT_HEIGHT)
  try {
    return read(outline)
  } finally {
    outline.delete()
  }
}

/** Area of the outline inside an axis-aligned box. */
function areaIn(outline: CrossSection, x: [number, number], y: [number, number]): number {
  const box = wasm.CrossSection.square([x[1] - x[0], y[1] - y[0]]).translate([x[0], y[0]])
  const part = outline.intersect(box)
  try {
    return part.area()
  } finally {
    box.delete()
    part.delete()
  }
}

describe('digitOutline', () => {
  it('draws every number from 1 to 36, DIGIT_HEIGHT tall and centred', () => {
    for (let n = 1; n <= 36; n++) {
      measure(n, (outline) => {
        const { min, max } = outline.bounds()
        expect(outline.area()).toBeGreaterThan(0)
        expect(max[1] - min[1]).toBeCloseTo(DIGIT_HEIGHT, 6)
        expect((min[0] + max[0]) / 2).toBeCloseTo(0, 6)
        expect((min[1] + max[1]) / 2).toBeCloseTo(0, 6)
      })
    }
  })

  it('gives an 8 more ink than a 1', () => {
    expect(measure(8, (o) => o.area())).toBeGreaterThan(measure(1, (o) => o.area()))
  })

  it('puts two digits side by side for 10 and up', () => {
    const wide = measure(22, (o) => o.bounds())
    const narrow = measure(2, (o) => o.bounds())
    expect(wide.max[0] - wide.min[0]).toBeGreaterThan(2 * (narrow.max[0] - narrow.min[0]))
  })

  it('is mirrored, so a 2 reads right from underneath', () => {
    // A 2's lower stroke is on its left; mirrored in x, seen from above it is on the +x side.
    const [left, right] = measure(2, (o) => [areaIn(o, [-10, 0], [-10, 0]), areaIn(o, [0, 10], [-10, 0])])
    expect(right).toBeGreaterThan(left)
  })
})
