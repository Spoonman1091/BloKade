import type { Edge, Shape3D } from 'replicad'
import type { Box } from '../document/box'
import type { EdgeKind, Vec3 } from '../document/types'
import { seamFlags } from './edge-seams'
import type { EdgeInfo } from './edge-select'

const SAMPLE_AT = [0, 0.25, 0.5, 0.75, 1] as const
const POLYLINE_STEPS = 16
const KINDS: Readonly<Record<string, EdgeKind>> = { LINE: 'line', CIRCLE: 'circle' }

interface VectorLike { readonly x: number; readonly y: number; readonly z: number; delete(): void }

/** Copies a replicad Vector into plain numbers and frees it. */
export function read(v: VectorLike): Vec3 {
  const out: Vec3 = [v.x, v.y, v.z]
  v.delete()
  return out
}

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(...v)
  return length > 1e-12 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0]
}

export function edgeInfo(edge: Edge, seam: boolean): EdgeInfo {
  return {
    kind: KINDS[edge.geomType] ?? 'other',
    samples: SAMPLE_AT.map((t) => read(edge.pointAt(t))),
    tangent: unit(read(edge.tangentAt(0.5))),
    length: edge.length,
    seam,
  }
}

/** Reads every edge of a shape, in replicad's edge order, telling `fn` whether it is a seam. Frees the wrappers. */
export function readEdges<T>(shape: Shape3D, fn: (edge: Edge, seam: boolean) => T): T[] {
  const edges = shape.edges
  try {
    const seams = seamFlags(shape, edges)
    return edges.map((edge, i) => fn(edge, seams[i] ?? false))
  } finally {
    edges.forEach((edge) => edge.delete())
  }
}

/** Facts about every edge of a shape, in replicad's edge order. */
export function edgeInfos(shape: Shape3D): EdgeInfo[] {
  return readEdges(shape, edgeInfo)
}

/** Points along an edge for drawing it: 2 for a straight edge, more for a curve. Flat x,y,z numbers. */
export function edgePolyline(edge: Edge): number[] {
  const steps = edge.geomType === 'LINE' ? 1 : POLYLINE_STEPS
  return Array.from({ length: steps + 1 }, (_, i) => read(edge.pointAt(i / steps))).flat()
}

export function shapeBox(shape: Shape3D): Box {
  const bb = shape.boundingBox
  try {
    const [[x0, y0, z0], [x1, y1, z1]] = bb.bounds
    return { min: [x0, y0, z0], max: [x1, y1, z1] }
  } finally {
    bb.delete()
  }
}
