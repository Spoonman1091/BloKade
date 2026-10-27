import { describe, expect, it } from 'vitest'
import {
  overhangTriangles, pickedMesh, thinTriangles, type TriangleSoup,
} from './print-analysis'

/** An axis-aligned box as 12 triangles wound counter-clockwise seen from outside. */
function boxSoup(x: number, y: number, z: number, w: number, d: number, h: number): TriangleSoup {
  const vertices: number[] = []
  for (let i = 0; i < 8; i++) vertices.push(x + (i & 1) * w, y + ((i >> 1) & 1) * d, z + ((i >> 2) & 1) * h)
  const centre = [x + w / 2, y + d / 2, z + h / 2]
  const quads = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]
  const triangles: number[] = []
  for (const q of quads) {
    for (const [a, b, c] of [[q[0]!, q[1]!, q[2]!], [q[0]!, q[2]!, q[3]!]] as const) {
      const p = (i: number, k: number) => vertices[i * 3 + k]!
      const u = [0, 1, 2].map((k) => p(b, k) - p(a, k))
      const v = [0, 1, 2].map((k) => p(c, k) - p(a, k))
      const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!]
      const out = [0, 1, 2].reduce((s, k) => s + n[k]! * (p(a, k) - centre[k]!), 0)
      triangles.push(...(out > 0 ? [a, b, c] : [a, c, b]))
    }
  }
  return { vertices, triangles }
}

function concat(a: TriangleSoup, b: TriangleSoup): TriangleSoup {
  const offset = a.vertices.length / 3
  return {
    vertices: [...Array.from(a.vertices), ...Array.from(b.vertices)],
    triangles: [...Array.from(a.triangles), ...Array.from(b.triangles).map((i) => i + offset)],
  }
}

describe('box soup helper', () => {
  it('winds the bottom triangles to face straight down', () => {
    const soup = boxSoup(0, 0, 0, 10, 10, 10)
    const mesh = pickedMesh(soup, [...Array(12).keys()])
    const down = []
    for (let t = 0; t < 12; t++) if (mesh.normals[t * 9 + 2]! < -0.99) down.push(t)
    expect(down).toHaveLength(2)
  })
})

describe('overhangTriangles', () => {
  it('finds nothing on a box sitting on the plate', () => {
    expect(overhangTriangles(boxSoup(0, 0, 0, 10, 10, 10), 0)).toEqual({ picked: [], area: 0 })
  })

  it('reports the bottom of a box raised 5 mm', () => {
    const r = overhangTriangles(boxSoup(0, 0, 5, 20, 30, 10), 0)
    expect(r.picked).toHaveLength(2)
    expect(r.area).toBeCloseTo(600, 6)
  })

  it('counts the underside of a T-shape bar but not the stem on the plate', () => {
    const t = concat(boxSoup(15, 0, 0, 10, 10, 20), boxSoup(0, 0, 20, 40, 10, 5))
    expect(overhangTriangles(t, 0).area).toBeCloseTo(400, 6)
  })

  it('does not report a bowl resting on its bottom point', () => {
    // A cone-shaped bowl: apex on the plate, rim 1 mm up per 0.5 mm out, so it faces down steeply.
    const ring = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4), 0.5] as const)
    const vertices = [0, 0, 0, ...ring.flat()]
    const triangles = ring.flatMap((_, i) => [0, 1 + i, 1 + ((i + 1) % 8)])
    const flipped = triangles.map((v, i) => (i % 3 === 0 ? v : triangles[i % 3 === 1 ? i + 1 : i - 1]!))
    expect(overhangTriangles({ vertices, triangles: flipped }, 0)).toEqual({ picked: [], area: 0 })
    expect(overhangTriangles({ vertices: vertices.map((v, i) => (i % 3 === 2 ? v + 5 : v)), triangles: flipped }, 0).picked)
      .toHaveLength(8)
  })

  it('ignores an exact 45 degree slope but flags a 30 degree one', () => {
    const slope = (rise: number): TriangleSoup => ({
      vertices: [0, 0, 10, 0, 10, 10 + rise, 10, 0, 10], triangles: [0, 1, 2],
    })
    expect(overhangTriangles(slope(10), 0).picked).toEqual([])
    expect(overhangTriangles(slope(10 * Math.tan(Math.PI / 6)), 0).picked).toEqual([0])
  })
})

describe('thinTriangles', () => {
  it('finds no thin walls in a 20 mm box', () => {
    const r = thinTriangles(boxSoup(0, 0, 0, 20, 20, 20))
    expect(r.picked).toEqual([])
    expect(r.finished).toBe(true)
  })

  it('calls a 0.5 mm plate thin but not very thin', () => {
    const r = thinTriangles(boxSoup(0, 0, 0, 20, 20, 0.5))
    expect(r.picked.length).toBeGreaterThan(0)
    expect(r.veryThin).toBe(false)
  })

  it('calls a 0.3 mm plate very thin', () => {
    expect(thinTriangles(boxSoup(0, 0, 0, 20, 20, 0.3)).veryThin).toBe(true)
  })

  it('keeps what it found when the clock runs out after the first 500 triangles', () => {
    const plates = Array.from({ length: 60 }, (_, i) => boxSoup(i * 30, 0, 0, 20, 20, 0.5))
    const soup = plates.reduce(concat) // 720 triangles
    let total = 0
    thinTriangles(soup, () => total++)
    let calls = 0
    const r = thinTriangles(soup, () => (++calls >= total ? 6000 : 0))
    expect(r.finished).toBe(false)
    expect(r.picked.length).toBeGreaterThan(0)
  })

  it('handles a 150 mm box rotated about two axes quickly', () => {
    const box = boxSoup(0, 0, 0, 150, 150, 150)
    const [c1, s1, c2, s2] = [Math.cos(0.5236), Math.sin(0.5236), Math.cos(0.6981), Math.sin(0.6981)]
    const vertices: number[] = []
    for (let i = 0; i < box.vertices.length; i += 3) {
      const [x, y, z] = [box.vertices[i]!, box.vertices[i + 1]!, box.vertices[i + 2]!]
      const [y1, z1] = [y * c1 - z * s1, y * s1 + z * c1]
      vertices.push(x * c2 + z1 * s2, y1, -x * s2 + z1 * c2)
    }
    const t0 = performance.now()
    const r = thinTriangles({ vertices, triangles: box.triangles })
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(r.finished).toBe(true)
    expect(r.picked).toEqual([])
  })

  it('stops the thin check when out of time', () => {
    let calls = 0
    const r = thinTriangles(boxSoup(0, 0, 0, 20, 20, 0.5), () => (calls++ === 0 ? 0 : 6000))
    expect(r.finished).toBe(false)
  })
})

describe('pickedMesh', () => {
  it('copies only the picked triangles', () => {
    const mesh = pickedMesh(boxSoup(0, 0, 0, 10, 10, 10), [0, 5, 7])
    expect(mesh.positions).toHaveLength(27)
    expect(mesh.normals).toHaveLength(27)
    expect(mesh.indices).toHaveLength(9)
    expect(mesh.edges).toHaveLength(0)
  })
})
