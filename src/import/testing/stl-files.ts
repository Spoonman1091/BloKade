import type { TestMesh } from '../../geometry/testing/meshes'

const HEADER_BYTES = 80
const TRIANGLE_BYTES = 50

/** A binary STL file for a test mesh (normals are left at zero). */
export function binaryStl(mesh: TestMesh, header = ''): ArrayBuffer {
  const count = mesh.triangles.length / 3
  const buffer = new ArrayBuffer(HEADER_BYTES + 4 + count * TRIANGLE_BYTES)
  const view = new DataView(buffer)
  new Uint8Array(buffer).set(new TextEncoder().encode(header).slice(0, HEADER_BYTES))
  view.setUint32(HEADER_BYTES, count, true)
  for (let t = 0; t < count; t++) {
    const base = HEADER_BYTES + 4 + t * TRIANGLE_BYTES + 12
    for (let corner = 0; corner < 3; corner++) {
      const vertex = mesh.triangles[t * 3 + corner] ?? 0
      for (let axis = 0; axis < 3; axis++) {
        view.setFloat32(base + (corner * 3 + axis) * 4, mesh.vertices[vertex * 3 + axis] ?? 0, true)
      }
    }
  }
  return buffer
}

/** An ASCII STL file for a test mesh. */
export function asciiStl(mesh: TestMesh): ArrayBuffer {
  const lines = ['solid test']
  for (let t = 0; t < mesh.triangles.length / 3; t++) {
    lines.push('facet normal 0 0 0', 'outer loop')
    for (let corner = 0; corner < 3; corner++) {
      const vertex = mesh.triangles[t * 3 + corner] ?? 0
      lines.push(`vertex ${mesh.vertices[vertex * 3] ?? 0} ${mesh.vertices[vertex * 3 + 1] ?? 0} ${mesh.vertices[vertex * 3 + 2] ?? 0}`)
    }
    lines.push('endloop', 'endfacet')
  }
  lines.push('endsolid test')
  return new TextEncoder().encode(lines.join('\n')).buffer as ArrayBuffer
}

/** The same mesh moved by `offset`. */
export function shifted(mesh: TestMesh, offset: readonly [number, number, number]): TestMesh {
  return { triangles: mesh.triangles, vertices: mesh.vertices.map((v, i) => v + (offset[i % 3] ?? 0)) }
}
