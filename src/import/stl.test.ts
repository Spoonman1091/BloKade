import { describe, expect, it } from 'vitest'
import { cubeMesh } from '../geometry/testing/meshes'
import { NO_TRIANGLES, NOT_STL } from './limits'
import { parseStl } from './stl'
import { asciiStl, binaryStl } from './testing/stl-files'

describe('parseStl', () => {
  it('reads a binary STL', () => expect(parseStl(binaryStl(cubeMesh(10))).triangles.length).toBe(36))
  it('reads an ASCII STL', () => expect(parseStl(asciiStl(cubeMesh(10))).vertices.length).toBe(108))
  it('reads a binary file whose header starts with solid', () => {
    expect(parseStl(binaryStl(cubeMesh(10), 'solid exported by CAD')).triangles.length).toBe(36)
  })
  it('refuses something that is not an STL', () => {
    expect(() => parseStl(new TextEncoder().encode('hello there').buffer as ArrayBuffer)).toThrow(NOT_STL)
  })
  it('refuses an STL with no triangles', () => {
    expect(() => parseStl(binaryStl({ vertices: [], triangles: [] }))).toThrow(NO_TRIANGLES)
  })
  it('reads a binary file with padding bytes at the end', () => {
    const file = binaryStl(cubeMesh(10))
    const padded = new Uint8Array(file.byteLength + 16)
    padded.set(new Uint8Array(file))
    expect(parseStl(padded.buffer).triangles.length).toBe(36)
  })
  it('reads a padded binary file whose header starts with solid', () => {
    const file = binaryStl(cubeMesh(10), 'solid exported by CAD')
    const padded = new Uint8Array(file.byteLength + 16)
    padded.set(new Uint8Array(file))
    expect(parseStl(padded.buffer).triangles.length).toBe(36)
  })
})
