import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { createModifier } from '../document/modifiers'
import type { EdgeSelection, Modifier } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { edgeInfos, shapeBox } from './edge-info'
import { fingerprintOf, matchesDescription } from './edge-select'
import { applyModifiers, ModifierError } from './modifiers'
import { initTestOC } from './testing/oc-node'

beforeAll(initTestOC)

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
    const [[, , z0]] = shape.boundingBox.bounds
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
})
