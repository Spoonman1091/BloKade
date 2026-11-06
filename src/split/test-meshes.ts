import { binaryStl } from '../import/testing/stl-files'

export interface Raised { x: [number, number]; y: [number, number]; height: number }

type Point = readonly [number, number, number]

/** Sorted, de-duplicated grid lines so raised blocks share corners with the plate. */
function lines(ends: readonly [number, number], extra: readonly number[]): number[] {
  return [...new Set([ends[0], ends[1], ...extra.filter((v) => v > ends[0] && v < ends[1])])].sort((a, b) => a - b)
}

/** A flat plate on z = 0, centred on x and y, with raised blocks. Binary STL, watertight. */
export function plateStl(opts: { width: number; depth: number; base: number; raised?: readonly Raised[] }): ArrayBuffer {
  const raised = opts.raised ?? []
  const xs = lines([-opts.width / 2, opts.width / 2], raised.flatMap((r) => r.x))
  const ys = lines([-opts.depth / 2, opts.depth / 2], raised.flatMap((r) => r.y))
  const heightAt = (i: number, j: number): number => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return 0
    const cx = ((xs[i] ?? 0) + (xs[i + 1] ?? 0)) / 2
    const cy = ((ys[j] ?? 0) + (ys[j + 1] ?? 0)) / 2
    const block = raised.find((r) => cx > r.x[0] && cx < r.x[1] && cy > r.y[0] && cy < r.y[1])
    return opts.base + (block?.height ?? 0)
  }
  const vertices: number[] = []
  const triangles: number[] = []
  const quad = (a: Point, b: Point, c: Point, d: Point): void => {
    const first = vertices.length / 3
    for (const p of [a, b, c, d]) vertices.push(...p)
    triangles.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const [x0, x1, y0, y1] = [xs[i] ?? 0, xs[i + 1] ?? 0, ys[j] ?? 0, ys[j + 1] ?? 0]
      const h = heightAt(i, j)
      quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h])
      quad([x0, y0, 0], [x0, y1, 0], [x1, y1, 0], [x1, y0, 0])
      // Walls toward +x and +y neighbours (and the outside), facing out of the taller side.
      const right = heightAt(i + 1, j)
      if (h > right) quad([x1, y0, right], [x1, y1, right], [x1, y1, h], [x1, y0, h])
      else if (right > h) quad([x1, y0, h], [x1, y0, right], [x1, y1, right], [x1, y1, h])
      const back = heightAt(i, j + 1)
      if (h > back) quad([x0, y1, back], [x0, y1, h], [x1, y1, h], [x1, y1, back])
      else if (back > h) quad([x0, y1, h], [x1, y1, h], [x1, y1, back], [x0, y1, back])
      // Walls toward -x / -y only at the plate's own edge (inner ones come from the neighbour).
      if (i === 0) quad([x0, y0, 0], [x0, y0, h], [x0, y1, h], [x0, y1, 0])
      if (j === 0) quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h])
    }
  }
  return binaryStl({ vertices, triangles })
}

/** The same file with the triangle at `index` cut out, so the surface has a gap. */
export function withoutTriangle(file: ArrayBuffer, index: number): ArrayBuffer {
  const header = 84
  const size = 50
  const bytes = new Uint8Array(file)
  const count = new DataView(file).getUint32(80, true)
  const out = new Uint8Array(header + (count - 1) * size)
  out.set(bytes.subarray(0, header))
  out.set(bytes.subarray(header, header + index * size), header)
  out.set(bytes.subarray(header + (index + 1) * size), header + index * size)
  new DataView(out.buffer).setUint32(80, count - 1, true)
  return out.buffer
}

export function triangleCountOf(file: ArrayBuffer): number {
  return new DataView(file).getUint32(80, true)
}
