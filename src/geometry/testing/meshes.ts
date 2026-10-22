/** Triangle meshes for tests: flat vertex numbers (x, y, z, ...) and vertex indices, three per triangle. */
export interface TestMesh {
  readonly vertices: number[]
  readonly triangles: number[]
}

// Outward-facing triangles of a cube, top two last, as corner indices (corners: bit0 = x, bit1 = y, bit2 = z).
const SIDE_TRIANGLES = [0, 2, 3, 0, 3, 1, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5, 4, 5, 7, 4, 7, 6]
const WITHOUT_TOP = 30

function cubeCorners(size: number): number[] {
  const half = size / 2
  return Array.from({ length: 8 }, (_, i) => [i & 1 ? half : -half, i & 2 ? half : -half, i & 4 ? size : 0]).flat()
}

/** A closed cube, centred on x and y, standing on z = 0. */
export function cubeMesh(size: number): TestMesh {
  return { vertices: cubeCorners(size), triangles: SIDE_TRIANGLES.slice() }
}

/** The same cube without its top two triangles, so it has a hole. */
export function openCubeMesh(size: number): TestMesh {
  return { vertices: cubeCorners(size), triangles: SIDE_TRIANGLES.slice(0, WITHOUT_TOP) }
}

/** A closed UV sphere resting on z = 0 with `2 * segments * (rings - 1)` triangles. */
export function sphereMesh(diameter: number, segments: number, rings: number): TestMesh {
  const r = diameter / 2
  const ring = (k: number) =>
    Array.from({ length: segments }, (_, s) => {
      const phi = (Math.PI * k) / rings
      const theta = (2 * Math.PI * s) / segments
      return [r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r + r * Math.cos(phi)]
    }).flat()
  const middle = Array.from({ length: rings - 1 }, (_, k) => ring(k + 1)).flat()
  const vertices = [0, 0, diameter, ...middle, 0, 0, 0]
  const south = 1 + (rings - 1) * segments
  const at = (k: number, s: number) => 1 + (k - 1) * segments + (s % segments)
  const caps = Array.from({ length: segments }, (_, s) => [
    [0, at(1, s), at(1, s + 1)],
    [south, at(rings - 1, s + 1), at(rings - 1, s)],
  ]).flat(2)
  const bands = Array.from({ length: rings - 2 }, (_, i) =>
    Array.from({ length: segments }, (_, s) => {
      const k = i + 1
      return [at(k, s), at(k + 1, s + 1), at(k, s + 1), at(k, s), at(k + 1, s), at(k + 1, s + 1)]
    }).flat(),
  ).flat()
  return { vertices, triangles: [...caps, ...bands] }
}

/** What addImportedPart needs to add a test mesh as a part, with the mesh's own size. */
export function importInput(mesh: TestMesh, name = 'Model') {
  const vertices = new Float32Array(mesh.vertices)
  const [min, max] = [0, 1, 2].map((axis) => {
    const values = mesh.vertices.filter((_, i) => i % 3 === axis)
    return [Math.min(...values), Math.max(...values)] as const
  }).reduce<[number[], number[]]>(([lo, hi], [a, b]) => [[...lo, a], [...hi, b]], [[], []])
  const size = [0, 1, 2].map((i) => (max?.[i] ?? 0) - (min?.[i] ?? 0)) as [number, number, number]
  return { name, vertices, triangles: new Uint32Array(mesh.triangles), size, color: '#ffffff' }
}
