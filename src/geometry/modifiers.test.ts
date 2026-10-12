import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { createModifier } from '../document/modifiers'
import type { EdgeSelection, Modifier } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { edgeInfos, edgePolyline, shapeBox } from './edge-info'
import { fingerprintOf, matchesDescription } from './edge-select'
import { applyModifiers, ModifierError } from './modifiers'
import { loadTestFont } from './testing/font-node'
import { initTestOC } from './testing/oc-node'

beforeAll(async () => {
  await initTestOC()
  await loadTestFont()
})

const cad = () => createCadToolkit()
const round = (radius: number, edges: EdgeSelection = { by: 'description', which: 'top' }): Modifier =>
  ({ ...createModifier('fillet', 'aaaaaaaa'), radius, edges } as Modifier)
const bevel = (distance: number, edges: EdgeSelection = { by: 'description', which: 'top' }): Modifier =>
  ({ ...createModifier('chamfer', 'bbbbbbbb'), distance, edges } as Modifier)

function volumeOf(shape: Shape3D): number {
  try {
    return measureVolume(shape)
  } finally {
    shape.delete()
  }
}

function errorOf(run: () => unknown): ModifierError {
  try { run() } catch (error) { if (error instanceof ModifierError) return error }
  throw new Error('expected a ModifierError')
}

describe('Round edges and Bevel edges', () => {
  it('rounds the top edges of a box and leaves the bottom square', () => {
    const { shape, warnings } = applyModifiers(cad().box(20, 20, 20), [round(2)])
    expect(warnings).toEqual({})
    const bb = shape.boundingBox
    const [[, , z0]] = bb.bounds
    bb.delete()
    expect(z0).toBeCloseTo(0, 5)
    const v = volumeOf(shape)
    expect(v).toBeGreaterThan(7900)
    expect(v).toBeLessThan(7990)
  })

  it('bevels the top edges', () => {
    const v = volumeOf(applyModifiers(cad().box(20, 20, 20), [bevel(2)]).shape)
    expect(v).toBeGreaterThan(7800)
    expect(v).toBeLessThan(7900)
  })

  it('still rounds after the part is resized', () => {
    expect(volumeOf(applyModifiers(cad().box(40, 20, 10), [round(2)]).shape)).toBeLessThan(8000)
  })

  it('rounds every edge of a cylinder', () => {
    expect(volumeOf(applyModifiers(cad().cylinder(20, 20), [round(2, { by: 'description', which: 'all' })]).shape))
      .toBeLessThan(Math.PI * 100 * 20)
  })

  it('explains a rounding that is too big for the part (Review Focus 1)', () => {
    expect(errorOf(() => applyModifiers(cad().box(20, 20, 20), [round(15)])).message)
      .toBe('Round edges: 15 mm is too big for these edges. Try a smaller size.')
  })

  it("explains edges that can't be rounded at any size", () => {
    const touching = (() => {
      const a = cad().box(10, 10, 10)
      const b = cad().box(10, 10, 10).translate([10, 10, 0])
      try { return a.fuse(b) } finally { a.delete(); b.delete() }
    })()
    const all: EdgeSelection = { by: 'description', which: 'all' }
    expect(errorOf(() => applyModifiers(touching.clone(), [round(1, all)])).message)
      .toBe("Round edges can't round these edges. Try choosing different edges.")
    expect(errorOf(() => applyModifiers(touching, [bevel(1, all)])).message)
      .toBe("Bevel edges can't bevel these edges. Try choosing different edges.")
  })

  it('ignores the seam line of a cylinder (Review Focus 1)', () => {
    const { shape, warnings } = applyModifiers(cad().cylinder(20, 20), [round(0.05, { by: 'description', which: 'vertical' })])
    expect(warnings).toEqual({ aaaaaaaa: 'No edges match, so this does nothing yet.' })
    shape.delete()
  })

  it('does not fail on round shapes with seams (Review Focus 1)', () => {
    const all: EdgeSelection = { by: 'description', which: 'all' }
    for (const make of [() => cad().sphere(20), () => cad().torus(40, 10)]) {
      const { shape, warnings } = applyModifiers(make(), [round(2, all)])
      expect(Object.values(warnings).every((w) => w === 'No edges match, so this does nothing yet.')).toBe(true)
      shape.delete()
    }
  })

  it('does nothing, with a hint, when no edge matches', () => {
    const { shape, warnings } = applyModifiers(cad().sphere(20), [round(2)])
    expect(warnings).toEqual({ aaaaaaaa: 'No edges match, so this does nothing yet.' })
    expect(volumeOf(shape)).toBeCloseTo((4 / 3) * Math.PI * 1000, 0)
  })

  it('keeps picked edges after resizing and warns about lost ones (Review Focus 3)', () => {
    const source = cad().box(20, 20, 20)
    const box = shapeBox(source)
    const topEdges = edgeInfos(source).filter((info) => matchesDescription(info, 'top', box)).map((info) => fingerprintOf(info, box))
    source.delete()
    expect(topEdges).toHaveLength(4)
    const picked: EdgeSelection = { by: 'picked', fingerprints: topEdges.slice(0, 2) }
    const kept = applyModifiers(cad().box(40, 20, 10), [round(2, picked)])
    expect(kept.warnings).toEqual({})
    expect(volumeOf(kept.shape)).toBeLessThan(8000)
    const lost = applyModifiers(cad().sphere(20), [round(2, picked)])
    expect(lost.warnings.aaaaaaaa).toBe('Lost track of 2 edges — click Pick edges to choose them again.')
    lost.shape.delete()
  })

  it('skips disabled modifiers', () => {
    expect(volumeOf(applyModifiers(cad().box(20, 20, 20), [{ ...round(2), enabled: false } as Modifier]).shape)).toBeCloseTo(8000, 3)
  })

  it('draws edges as 2 points for a line and 17 for a curve', () => {
    const lengths = (shape: Shape3D, kind: string) =>
      shape.edges.flatMap((edge) => {
        const out = edge.geomType === kind ? [edgePolyline(edge).length] : []
        edge.delete()
        return out
      })
    const box = cad().box(20, 20, 20)
    const cylinder = cad().cylinder(20, 20)
    expect(lengths(box, 'LINE')[0]).toBe(6)
    expect(lengths(cylinder, 'CIRCLE')[0]).toBe(51)
    box.delete()
    cylinder.delete()
  })
})

const row = (count: number, spacing: [number, number, number], id = 'cccccccc'): Modifier =>
  ({ ...createModifier('linearPattern', id), count, spacing } as Modifier)
const circle = (count: number, angle: number, center: [number, number, number]): Modifier =>
  ({ ...createModifier('circularPattern', 'dddddddd'), count, angle, center } as Modifier)
const mirror = (plane: 'XY' | 'XZ' | 'YZ', keepOriginal: boolean): Modifier =>
  ({ ...createModifier('mirror', 'eeeeeeee'), plane, keepOriginal } as Modifier)

function xRange(shape: Shape3D): number[] {
  const { min, max } = shapeBox(shape)
  return [Math.round(min[0] * 1000) / 1000, Math.round(max[0] * 1000) / 1000]
}

describe('Repeat and Mirror', () => {
  it('repeats in a row', () => {
    const { shape } = applyModifiers(cad().box(20, 20, 20), [row(3, [30, 0, 0])])
    expect(xRange(shape)).toEqual([-10, 70])
    expect(volumeOf(shape)).toBeCloseTo(24000, 0)
  })

  it('leaves a part alone when repeated once', () => {
    expect(volumeOf(applyModifiers(cad().box(20, 20, 20), [row(1, [30, 0, 0])]).shape)).toBeCloseTo(8000, 0)
  })

  it('repeats in a circle around a center point', () => {
    const { shape } = applyModifiers(cad().box(20, 20, 20), [circle(4, 360, [-30, 0, 0])])
    expect(xRange(shape)).toEqual([-70, 10])
    expect(volumeOf(shape)).toBeCloseTo(32000, 0)
  })

  it('spreads copies over part of a circle', () => {
    const { shape } = applyModifiers(cad().box(2, 2, 2), [circle(3, 180, [-30, 0, 0])])
    expect(xRange(shape)).toEqual([-61, 1])
    shape.delete()
  })

  it('mirrors, keeping or replacing the original', () => {
    const kept = applyModifiers(cad().box(20, 20, 20), [row(2, [30, 0, 0]), mirror('YZ', true)]).shape
    expect(xRange(kept)).toEqual([-40, 40])
    expect(volumeOf(kept)).toBeCloseTo(24000, 0)
    const replaced = applyModifiers(cad().box(20, 20, 20), [row(2, [30, 0, 0]), mirror('YZ', false)]).shape
    expect(xRange(replaced)).toEqual([-40, 10])
    replaced.delete()
  })

  it('refuses stacks that make too many copies before doing any work (Review Focus 2)', () => {
    const started = Date.now()
    const error = errorOf(() => applyModifiers(cad().box(2, 2, 2), [row(50, [3, 0, 0]), row(50, [0, 3, 0], 'ffffffff')]))
    expect(error.message).toBe('These modifiers make 2500 copies. BloKade can make up to 200 at once — use smaller counts.')
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('counts a mirror that keeps the original as two copies', () => {
    expect(() => applyModifiers(cad().box(2, 2, 2), [row(50, [3, 0, 0]), row(3, [0, 3, 0], 'ffffffff'), mirror('XY', true)]))
      .toThrow('make 300 copies')
  })

  it('refuses to repeat a very detailed part many times, instantly (Review Focus 2)', () => {
    const started = Date.now()
    const error = errorOf(() => applyModifiers(cad().text('HELLO WORLD', 10, 3), [row(50, [80, 0, 0])]))
    expect(error.message).toBe('This part is too detailed to repeat that many times. Try fewer copies.')
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('still repeats simple parts the full 200 times quickly', () => {
    const started = Date.now()
    const { shape } = applyModifiers(cad().box(2, 2, 2), [row(200, [3, 0, 0])])
    expect(volumeOf(shape)).toBeCloseTo(1600, 0)
    expect(Date.now() - started).toBeLessThan(5000)
  }, 20_000)

  it('repeats letters a sensible number of times', () => {
    const { shape } = applyModifiers(cad().text('HI', 10, 3), [row(20, [30, 0, 0])])
    expect(xRange(shape)[1]! - xRange(shape)[0]!).toBeGreaterThan(570)
    shape.delete()
  }, 20_000)
})
