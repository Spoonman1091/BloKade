import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { createCadToolkit } from '../plugins/cad'
import { Outline, Part, ShapeTracker } from './part'

beforeAll(initTestOC)

// `+ 0` turns -0 into 0, because toEqual tells them apart.
const bounds = (shape: Shape3D) => shape.boundingBox.bounds.map((p) => p.map((v) => Math.round(v * 100) / 100 + 0))
const setup = () => {
  const tracker = new ShapeTracker()
  const cad = createCadToolkit()
  const part = (shape: Shape3D) => new Part(tracker, tracker.track(shape))
  return { tracker, cad, part, box: () => part(cad.box(10, 10, 10)) }
}

describe('Part steps', () => {
  it('moves into a new part and leaves the old one where it was', () => {
    const { box } = setup()
    const original = box()
    const moved = original.move(20, 0, 5)
    expect(bounds(moved.shape)).toEqual([[15, -5, 5], [25, 5, 15]])
    expect(bounds(original.shape)).toEqual([[-5, -5, 0], [5, 5, 10]])
  })
  it('turns around an axis through the middle of the ground', () => {
    const { part, cad } = setup()
    const turned = part(cad.box(20, 10, 4)).rotate('z', 90)
    expect(bounds(turned.shape)).toEqual([[-5, -10, 0], [5, 10, 4]])
  })
  it('adds, cuts and overlaps', () => {
    const { box } = setup()
    const a = box()
    const b = box().move(5, 0, 0)
    expect(measureVolume(a.add(b).shape)).toBeCloseTo(1500, 0)
    expect(measureVolume(a.cut(b).shape)).toBeCloseTo(500, 0)
    expect(measureVolume(a.overlap(b).shape)).toBeCloseTo(500, 0)
    expect(measureVolume(a.shape)).toBeCloseTo(1000, 0)
  })
  it('mirrors across the middle', () => {
    const { box } = setup()
    expect(bounds(box().move(20, 0, 0).mirror('x').shape)).toEqual([[-25, -5, 0], [-15, 5, 10]])
    expect(bounds(box().move(0, 0, 5).mirror('z').shape)).toEqual([[-5, -5, -15], [5, 5, -5]])
  })
  it('copies', () => {
    const { box } = setup()
    const original = box()
    const copy = original.copy()
    expect(copy.shape).not.toBe(original.shape)
    expect(bounds(copy.shape)).toEqual(bounds(original.shape))
  })
  it('explains bad steps', () => {
    const { box, tracker, cad } = setup()
    expect(() => box().move(1, 2)).toThrow('.move needs 3 numbers, like .move(10, 0, 0)')
    expect(() => box().move(1, 2, 3000)).toThrow('Moves can be up to 2000 mm — z was 3000')
    expect(() => box().rotate('up', 90)).toThrow(".rotate needs 'x', 'y' or 'z'")
    expect(() => box().add(5)).toThrow('.add needs a part, like .add(cad.box(10, 10, 10))')
    const outline = new Outline(tracker, cad, { kind: 'circle', diameter: 10 })
    expect(() => box().cut(outline)).toThrow('.cut needs a part, not an outline')
    expect(() => box().extrude(5)).toThrow('.extrude is for flat outlines, and this is already a part.')
  })
})

describe('Outline', () => {
  it('pushes a polygon up', () => {
    const { tracker, cad } = setup()
    const outline = new Outline(tracker, cad, { kind: 'polygon', points: [[0, 0], [20, 0], [0, 10]] })
    expect(bounds(outline.extrude(4).shape)).toEqual([[0, 0, 0], [20, 10, 4]])
  })
  it('pushes a circle up into a cylinder', () => {
    const { tracker, cad } = setup()
    expect(bounds(new Outline(tracker, cad, { kind: 'circle', diameter: 10 }).extrude(3).shape)).toEqual([[-5, -5, 0], [5, 5, 3]])
  })
  it('spins a polygon around the up axis', () => {
    const { tracker, cad } = setup()
    const outline = new Outline(tracker, cad, { kind: 'polygon', points: [[0, 0], [10, 0], [10, 5], [0, 5]] })
    expect(bounds(outline.spin().shape)).toEqual([[-10, -10, 0], [10, 10, 5]])
  })
  it('explains what an outline cannot do', () => {
    const { tracker, cad } = setup()
    const circle = new Outline(tracker, cad, { kind: 'circle', diameter: 10 })
    expect(() => circle.spin()).toThrow("A circle can't spin.")
    expect(() => circle.move(1, 0, 0)).toThrow('.move works on parts. Turn the outline into a part first with .extrude(height) or .spin().')
    expect(() => circle.extrude(-1)).toThrow('Sizes must be bigger than 0 — height was -1')
  })
})

describe('ShapeTracker', () => {
  it('frees every shape a build made except the result', () => {
    const { box, tracker } = setup()
    const a = box()
    const b = box().move(5, 0, 0)
    const result = a.add(b).rotate('z', 45)
    expect(tracker.counts()).toEqual({ made: 5, held: 5 })
    tracker.freeAllBut(result.shape)
    expect(tracker.counts()).toEqual({ made: 5, held: 0 })
    expect(measureVolume(result.shape)).toBeCloseTo(1500, 0)
  })
})
