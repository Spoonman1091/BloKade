import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { createCadToolkit } from './cad'
import { makeThread, MAX_THREAD_TURNS, threadRadius } from './cad-thread'

beforeAll(initTestOC)

function boundsOf(shape: Shape3D): number[][] {
  const box = shape.boundingBox
  try {
    return box.bounds.map((p) => p.map((v) => Math.round(v * 100) / 100))
  } finally {
    box.delete()
  }
}

describe('threadRadius', () => {
  it('follows root, flank, crest, flank, root over one pitch', () => {
    expect(threadRadius(0.05, 4, 0.75)).toBe(3.25)
    expect(threadRadius(0.275, 4, 0.75)).toBeCloseTo(3.625, 6)
    expect(threadRadius(0.5, 4, 0.75)).toBe(4)
    expect(threadRadius(0.725, 4, 0.75)).toBeCloseTo(3.625, 6)
    expect(threadRadius(0.95, 4, 0.75)).toBe(3.25)
    expect(threadRadius(1.5, 4, 0.75)).toBe(4)
    expect(threadRadius(-0.5, 4, 0.75)).toBe(4)
  })
})

describe('makeThread', () => {
  it('builds an M8 rod sitting on the ground', () => {
    const started = Date.now()
    const rod = makeThread(8, 1.25, 20)
    const elapsed = Date.now() - started
    const [min, max] = boundsOf(rod)
    expect([min?.[0], max?.[0], min?.[2], max?.[2]]).toEqual([-4, 4, 0, 20])
    const volume = measureVolume(rod)
    expect(volume).toBeGreaterThan(Math.PI * 3.25 ** 2 * 20)
    expect(volume).toBeLessThan(Math.PI * 4 ** 2 * 20)
    expect(elapsed).toBeLessThan(5000)
    rod.delete()
  })

  it('can be cut out of a block (Review Focus 4)', () => {
    const rod = makeThread(8, 1.25, 20)
    const block = createCadToolkit().box(20, 20, 15)
    const cut = block.cut(rod)
    try {
      const removed = 20 * 20 * 15 - measureVolume(cut)
      expect(removed).toBeGreaterThan(Math.PI * 3.25 ** 2 * 15)
      expect(removed).toBeLessThan(Math.PI * 4 ** 2 * 15)
    } finally {
      rod.delete()
      block.delete()
      cut.delete()
    }
  })

  it('refuses threads longer than the turn limit before building anything (Review Focus 4)', () => {
    const started = Date.now()
    expect(() => makeThread(6, 1, MAX_THREAD_TURNS + 1))
      .toThrow("Threads can be up to 40 turns long — that's 40 mm for this size. Make it shorter.")
    expect(Date.now() - started).toBeLessThan(100)
  })

  it('builds the longest allowed fine thread in a few seconds (Review Focus 4)', () => {
    const started = Date.now()
    const rod = makeThread(6, 1, 40)
    expect(Date.now() - started).toBeLessThan(8000)
    rod.delete()
  })

  it('explains sizes that make no thread', () => {
    expect(() => makeThread(1, 2, 10)).toThrow('That thread is too fine for its size.')
    expect(() => makeThread(8, 0, 10)).toThrow('That thread is too fine for its size.')
  })
})
