import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { createCadToolkit } from '../cad'
import { registry } from '../index'
import { defaultParams, resolveParams } from '../params'

beforeAll(initTestOC)

export function build(id: string, overrides: Record<string, number | string> = {}): Shape3D {
  const plugin = registry.get(id)
  if (!plugin) throw new Error(`missing plugin ${id}`)
  return plugin.build(resolveParams(plugin, { ...defaultParams(plugin), ...overrides }), createCadToolkit())
}

export function volumeOf(shape: Shape3D): number {
  try {
    return measureVolume(shape)
  } finally {
    shape.delete()
  }
}

describe('peg and socket', () => {
  it('builds round and square pegs', () => {
    expect(volumeOf(build('peg'))).toBeCloseTo(Math.PI * 16 * 10, 1)
    expect(volumeOf(build('peg', { shape: 'square' }))).toBeCloseTo(640, 3)
  })

  it('makes the socket bigger than the peg by the extra room on every side', () => {
    expect(volumeOf(build('socket', { clearance: 0.2 }))).toBeCloseTo(Math.PI * 4.2 ** 2 * 11, 1)
    expect(volumeOf(build('socket', { shape: 'square', clearance: 0.5 }))).toBeCloseTo(9 * 9 * 11, 3)
  })

  it('starts sockets as holes that follow fit', () => {
    const socket = registry.get('socket')
    expect(socket?.mode).toBe('hole')
    expect(socket?.params.clearance).toMatchObject({ formula: 'fit' })
    expect(registry.get('peg')?.mode).toBeUndefined()
  })
})

describe('screw hole', () => {
  const radiusAtTop = (shape: Shape3D): number => {
    const box = shape.boundingBox
    try {
      return box.bounds[1][0]
    } finally {
      box.delete()
      shape.delete()
    }
  }

  it('builds a plain M3 hole enlarged by the extra room', () => {
    expect(volumeOf(build('screw-hole', { clearance: 0.2 }))).toBeCloseTo(Math.PI * 1.7 ** 2 * 10, 1)
  })

  it('builds every style for every size', () => {
    for (const size of ['M2', 'M3', 'M4', 'M5']) {
      for (const style of ['plain', 'countersunk', 'counterbored', 'nut', 'insert']) {
        expect(volumeOf(build('screw-hole', { size, style, depth: 15 }))).toBeGreaterThan(0)
      }
    }
  })

  it('makes the countersink wide enough for the head', () => {
    expect(radiusAtTop(build('screw-hole', { style: 'countersunk', clearance: 0.2 }))).toBeCloseTo(3.56, 3)
  })

  it('fits an M3 nut in the trap', () => {
    const hole = build('screw-hole', { style: 'nut', clearance: 0.2 })
    expect(radiusAtTop(hole)).toBeCloseTo(5.9 / Math.sqrt(3), 3)
  })

  it('puts the nut trap at the bottom of the hole', () => {
    const hole = build('screw-hole', { style: 'nut', clearance: 0.2 })
    const slabVolume = (z: number): number => {
      const slab = createCadToolkit().box(20, 20, 0.5).translate(0, 0, z)
      const part = hole.intersect(slab)
      try {
        return measureVolume(part)
      } finally {
        slab.delete()
        part.delete()
      }
    }
    try {
      const bottom = slabVolume(0)
      const top = slabVolume(9.5)
      expect(bottom).toBeGreaterThan(top * 2)
      expect(top).toBeCloseTo(Math.PI * 1.7 ** 2 * 0.5, 1)
    } finally {
      hole.delete()
    }
  })

  it('reports a hole too shallow for its head (Review Focus 3)', () => {
    expect(() => build('screw-hole', { style: 'counterbored', depth: 3 })).toThrow('so the screw head fits')
  })

  it('starts as a hole that follows fit', () => {
    const plugin = registry.get('screw-hole')
    expect(plugin).toMatchObject({ mode: 'hole', palette: 'fit' })
    expect(plugin?.params.clearance).toMatchObject({ formula: 'fit' })
  })
})

describe('threads', () => {
  const xMax = (shape: Shape3D): number => {
    const box = shape.boundingBox
    try {
      return box.bounds[1][0]
    } finally {
      box.delete()
      shape.delete()
    }
  }

  it('builds an M8 rod and a hole bigger by the extra room', () => {
    expect(xMax(build('threaded-rod'))).toBeCloseTo(4, 2)
    expect(xMax(build('threaded-hole', { clearance: 0.2 }))).toBeCloseTo(4.2, 2)
  })

  it('a rod fits inside its matching hole (Review Focus 4)', () => {
    const rod = build('threaded-rod', { length: 10 })
    const hole = build('threaded-hole', { depth: 10, clearance: 0.2 })
    const sticksOut = rod.cut(hole)
    try {
      expect(measureVolume(sticksOut)).toBeLessThan(0.5)
    } finally {
      rod.delete()
      hole.delete()
      sticksOut.delete()
    }
  })

  it('explains threads that are too long', () => {
    expect(() => build('threaded-rod', { size: 'M6', length: 60 })).toThrow('Threads can be up to 40 turns long')
  })

  it('still builds a small hole with lots of extra room (Review Focus 4)', () => {
    expect(volumeOf(build('threaded-hole', { size: 'M6', depth: 10, clearance: 2 }))).toBeGreaterThan(0)
  })
})

describe('snap-fit clip and catch', () => {
  it('builds an arm with a barbed hook', () => {
    const ramp = 2
    expect(volumeOf(build('snap-clip'))).toBeCloseTo(6 * (1.5 * 12 + (1 * ramp) / 2), 3)
  })

  it('makes the catch slot fit the arm but not the hook', () => {
    expect(volumeOf(build('snap-catch', { clearance: 0.2 }))).toBeCloseTo(1.9 * 6.4 * 5, 3)
  })

  it('runs the catch slot from 1 mm below to 1 mm above the wall', () => {
    const catchSlot = build('snap-catch')
    const box = catchSlot.boundingBox
    try {
      expect(box.bounds[0][2]).toBeCloseTo(-1, 3)
      expect(box.bounds[1][2]).toBeCloseTo(4, 3)
    } finally {
      box.delete()
      catchSlot.delete()
    }
  })

  it('explains an arm too short for its hook', () => {
    expect(() => build('snap-clip', { length: 4, hook: 2 })).toThrow('Make the arm longer than 5 mm for that hook.')
  })
})
