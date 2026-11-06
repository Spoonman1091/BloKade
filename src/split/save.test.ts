import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { baseName, binaryStl, zipPieces } from './save'
import type { PieceMesh } from './types'

/** A 10 x 10 x 4 box whose min corner is at (ox, oy, oz). */
function box(number: number, ox: number, oy: number, oz: number): PieceMesh {
  const v: number[] = []
  for (const z of [0, 4]) for (const y of [0, 10]) for (const x of [0, 10]) v.push(ox + x, oy + y, oz + z)
  const t = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5]
  return { number, vertices: Float32Array.from(v), triangles: Uint32Array.from(t), size: [10, 10, 4], fits: true }
}

function stlBounds(bytes: Uint8Array): { min: number[]; max: number[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getUint32(80, true)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let t = 0; t < count; t++) {
    for (let c = 0; c < 3; c++) for (let a = 0; a < 3; a++) {
      const value = view.getFloat32(84 + t * 50 + 12 + (c * 3 + a) * 4, true)
      min[a] = Math.min(min[a] ?? 0, value)
      max[a] = Math.max(max[a] ?? 0, value)
    }
  }
  return { min, max }
}

describe('binaryStl', () => {
  it('writes an 80-byte header, the count, and 50 bytes per triangle', () => {
    const bytes = binaryStl(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]), Uint32Array.from([0, 1, 2, 0, 3, 1]))
    expect(bytes.length).toBe(84 + 2 * 50)
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(80, true)).toBe(2)
    // first triangle: normal (0,0,1), then its three corners
    expect(view.getFloat32(84 + 8, true)).toBeCloseTo(1)
    expect(view.getFloat32(84 + 12 + 12, true)).toBe(1)
  })
})

describe('zipPieces', () => {
  it('holds one STL per piece, flat on z = 0 and centred', () => {
    const zip = zipPieces('plate', [box(1, 100, 50, 7), box(2, -20, 0, 0), box(3, 0, 0, 2), box(4, 5, 5, 5)])
    const files = unzipSync(zip)
    expect(Object.keys(files).sort()).toEqual(['plate-1.stl', 'plate-2.stl', 'plate-3.stl', 'plate-4.stl'])
    for (const bytes of Object.values(files)) {
      const { min, max } = stlBounds(bytes)
      expect(min[2]).toBeCloseTo(0)
      expect(max[2]).toBeCloseTo(4)
      expect(min[0]).toBeCloseTo(-5)
      expect(max[0]).toBeCloseTo(5)
      expect(min[1]).toBeCloseTo(-5)
      expect(max[1]).toBeCloseTo(5)
    }
  })
})

describe('baseName', () => {
  it('makes a safe file name stem', () => {
    expect(baseName('Punisher Chest Plate.stl')).toBe('punisher-chest-plate')
    expect(baseName('plate.STL')).toBe('plate')
    expect(baseName('  My__model (v2).stl ')).toBe('my-model-v2')
    expect(baseName('.stl')).toBe('model')
    expect(baseName('')).toBe('model')
  })
})
