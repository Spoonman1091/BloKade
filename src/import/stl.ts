import { NO_TRIANGLES, NOT_STL } from './limits'

const HEADER_BYTES = 80
const COUNT_END = 84
const TRIANGLE_BYTES = 50
const VERTEX_LINE = /^\s*vertex\s+(\S+)\s+(\S+)\s+(\S+)/gim

/** An STL problem; the message is always one a child can read. */
export class StlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StlError'
  }
}

export interface RawStl {
  /** Unwelded: nine numbers per triangle. */
  readonly vertices: Float32Array
  readonly triangles: Uint32Array
}

function isBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < COUNT_END) return false
  const count = new DataView(buffer).getUint32(HEADER_BYTES, true)
  return COUNT_END + TRIANGLE_BYTES * count === buffer.byteLength
}

function readBinary(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer)
  const count = view.getUint32(HEADER_BYTES, true)
  const vertices = new Float32Array(count * 9)
  for (let t = 0; t < count; t++) {
    const base = COUNT_END + t * TRIANGLE_BYTES + 12 // skip the normal
    for (let k = 0; k < 9; k++) vertices[t * 9 + k] = view.getFloat32(base + k * 4, true)
  }
  return vertices
}

function readAscii(buffer: ArrayBuffer): Float32Array {
  const text = new TextDecoder().decode(buffer)
  if (!/^\s*solid/i.test(text)) throw new StlError(NOT_STL)
  const numbers = [...text.matchAll(VERTEX_LINE)].flatMap((m) => [Number(m[1]), Number(m[2]), Number(m[3])])
  if (numbers.length % 9 !== 0) throw new StlError(NOT_STL)
  return Float32Array.from(numbers)
}

/** Reads a binary or ASCII STL into unwelded triangles. Throws StlError. */
export function parseStl(buffer: ArrayBuffer): RawStl {
  const vertices = isBinary(buffer) ? readBinary(buffer) : readAscii(buffer)
  if (vertices.length === 0) throw new StlError(NO_TRIANGLES)
  if (!vertices.every(Number.isFinite)) throw new StlError(NOT_STL)
  return { vertices, triangles: Uint32Array.from({ length: vertices.length / 3 }, (_, i) => i) }
}
