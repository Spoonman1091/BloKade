import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestFont } from '../geometry/testing/font-node'
import { initTestOC } from '../geometry/testing/oc-node'
import { Outline, Part, ShapeTracker } from './part'
import { createKadeToolkit } from './toolkit'

beforeAll(async () => {
  await initTestOC()
  await loadTestFont()
})

// `+ 0` turns -0 into 0, because toEqual tells them apart.
const bounds = (shape: Shape3D) => shape.boundingBox.bounds.map((p) => p.map((v) => Math.round(v * 10) / 10 + 0))
const kit = () => createKadeToolkit(new ShapeTracker())

describe('starting parts', () => {
  it('make parts centred on X/Y and sitting on the ground', () => {
    const cad = kit()
    expect(bounds(cad.box(20, 10, 5).shape)).toEqual([[-10, -5, 0], [10, 5, 5]])
    expect(bounds(cad.cylinder(10, 20).shape)).toEqual([[-5, -5, 0], [5, 5, 20]])
    expect(bounds(cad.sphere(20).shape)).toEqual([[-10, -10, 0], [10, 10, 20]])
    expect(bounds(cad.cone(20, 0, 30).shape)).toEqual([[-10, -10, 0], [10, 10, 30]])
    expect(bounds(cad.ring(40, 8).shape)).toEqual([[-20, -20, 0], [20, 20, 8]])
    expect(bounds(cad.wedge(20, 10, 15).shape)).toEqual([[-10, -5, 0], [10, 5, 15]])
    const letters = bounds(cad.text('Hi', 10, 2).shape)
    expect(letters[0]?.[2]).toBe(0)
    expect(letters[1]?.[2]).toBe(2)
  })
  it('explain bad sizes', () => {
    const cad = kit()
    expect(() => cad.box(20, 10)).toThrow('cad.box needs 3 sizes, like cad.box(20, 10, 5)')
    expect(() => cad.box(-3, 10, 5)).toThrow('Sizes must be bigger than 0 — width was -3')
    expect(() => cad.cylinder(10, 0)).toThrow('Sizes must be bigger than 0 — height was 0')
    expect(() => cad.sphere()).toThrow('cad.sphere needs a size, like cad.sphere(20)')
    expect(() => cad.cone(0, 0, 10)).toThrow('A cone needs a bottom or a top bigger than 0.')
    expect(() => cad.ring(10, 8)).toThrow('Make the ring wider than twice its thickness.')
    expect(() => cad.text(5, 10, 2)).toThrow("cad.text needs words in quotes first, like cad.text('Hi', 10, 2)")
    expect(() => cad.text('x'.repeat(41), 10, 2)).toThrow('cad.text can show up to 40 letters.')
  })
})

describe('outlines', () => {
  it('make flat outlines that turn into parts', () => {
    const cad = kit()
    expect(cad.rect(20, 10)).toBeInstanceOf(Outline)
    expect(bounds(cad.rect(20, 10).extrude(5).shape)).toEqual([[-10, -5, 0], [10, 5, 5]])
    expect(bounds(cad.circle(10).extrude(2).shape)).toEqual([[-5, -5, 0], [5, 5, 2]])
    expect(bounds(cad.polygon([[0, 0], [20, 0], [0, 10]]).extrude(4).shape)).toEqual([[0, 0, 0], [20, 10, 4]])
  })
  it('explain bad points', () => {
    const cad = kit()
    expect(() => cad.polygon([[0, 0], [1, 1]])).toThrow('cad.polygon needs a list of at least 3 points, like cad.polygon([[0, 0], [20, 0], [0, 20]])')
    expect(() => cad.polygon('square')).toThrow('at least 3 points')
    expect(() => cad.polygon([[0, 0], [1, 'a'], [2, 2]])).toThrow('cad.polygon: point 2 must be two numbers in brackets, like [10, 5]')
    expect(() => cad.polygon([[0, 0], [3000, 0], [0, 1]])).toThrow('Points can be up to 2000 mm from the middle.')
  })
})

describe('helpers', () => {
  it('repeat makes copies and joins them', () => {
    const cad = kit()
    const row = cad.repeat(3, (i: number) => cad.box(5, 5, 5).move(i * 10, 0, 0))
    expect(row).toBeInstanceOf(Part)
    expect(bounds(row.shape)).toEqual([[-2.5, -2.5, 0], [22.5, 2.5, 5]])
    expect(measureVolume(row.shape)).toBeCloseTo(375, 0)
    expect(bounds(cad.repeat(1, () => cad.box(5, 5, 5)).shape)).toEqual([[-2.5, -2.5, 0], [2.5, 2.5, 5]])
  })
  it('repeat explains mistakes', () => {
    const cad = kit()
    expect(() => cad.repeat(0, () => cad.box(1, 1, 1))).toThrow('cad.repeat: the count must be a whole number from 1 to 200 — it was 0')
    expect(() => cad.repeat(201, () => cad.box(1, 1, 1))).toThrow('from 1 to 200')
    expect(() => cad.repeat(3, 5)).toThrow('cad.repeat needs a function second, like (i) => cad.box(5, 5, 5).move(i * 10, 0, 0)')
    expect(() => cad.repeat(3, () => 5)).toThrow("cad.repeat's function must give back a part — copy 1 didn't.")
  })
  it('works out angles, sines and cosines in degrees', () => {
    const cad = kit()
    expect(cad.angle(1, 4)).toBe(90)
    expect(cad.angle(3, 12)).toBe(90)
    expect(cad.sin(30)).toBeCloseTo(0.5)
    expect(cad.cos(60)).toBeCloseTo(0.5)
    expect(() => cad.angle(1, 0)).toThrow('cad.angle: the count must be bigger than 0 — it was 0')
    expect(() => cad.sin('30')).toThrow('cad.sin: the angle must be a number')
  })
})
