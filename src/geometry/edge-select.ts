import { boxSize, type Box } from '../document/box'
import type { EdgeFingerprint, EdgeKind, EdgeSelection, EdgeWhich, Vec3 } from '../document/types'

/** Plain-number facts about one edge, read from OpenCascade by edge-info.ts. */
export interface EdgeInfo {
  readonly kind: EdgeKind
  /** Points at 0, ¼, ½, ¾ and 1 of the way along the edge. */
  readonly samples: readonly Vec3[]
  /** Unit direction at the midpoint. */
  readonly tangent: Vec3
  readonly length: number
  /** A closing line where a round face meets itself (a cylinder's side seam). Not a real edge, so never chosen. */
  readonly seam: boolean
}

/** Highest score that still counts as "the same edge". */
export const MATCH_THRESHOLD = 0.1

/** Length only breaks ties, so stretching a part one way doesn't lose its edges. */
export const LENGTH_WEIGHT = 0.05

const diagonal = (box: Box): number => Math.hypot(...boxSize(box))
export const edgeTolerance = (box: Box): number => Math.max(1e-4, diagonal(box) * 1e-4)
export const midOf = (info: EdgeInfo): Vec3 => info.samples[2] ?? info.samples[0] ?? [0, 0, 0]

const round4 = (v: number): number => {
  const r = Math.round(v * 1e4) / 1e4
  return Object.is(r, -0) ? 0 : r
}
const roundVec = (v: Vec3): Vec3 => [round4(v[0]), round4(v[1]), round4(v[2])]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export function matchesDescription(info: EdgeInfo, which: EdgeWhich, box: Box): boolean {
  const tol = edgeTolerance(box)
  // Collapsed edges (a sphere's poles) and seams can't be rounded and would make OpenCascade fail.
  if (info.seam || info.length <= tol) return false
  const zs = info.samples.map((p) => p[2])
  switch (which) {
    case 'all': return true
    case 'top': return zs.every((z) => z >= box.max[2] - tol)
    case 'bottom': return zs.every((z) => z <= box.min[2] + tol)
    case 'vertical': return info.kind === 'line' && Math.abs(info.tangent[2]) > 0.999
    case 'horizontal': return Math.max(...zs) - Math.min(...zs) <= tol
  }
}

/** Flips a direction so its first clearly non-zero component is positive (edges have no "forwards"). */
function canonical(dir: Vec3): Vec3 {
  const first = dir.find((c) => Math.abs(c) > 1e-6) ?? 0
  return first < 0 ? [-dir[0], -dir[1], -dir[2]] : dir
}

export function fingerprintOf(info: EdgeInfo, box: Box): EdgeFingerprint {
  const size = boxSize(box)
  const mid = midOf(info)
  const fraction = (i: 0 | 1 | 2): number => (size[i] > 1e-9 ? (mid[i] - box.min[i]) / size[i] : 0.5)
  return {
    kind: info.kind,
    mid: roundVec([fraction(0), fraction(1), fraction(2)]),
    dir: roundVec(canonical(info.tangent)),
    length: round4(info.length / Math.max(diagonal(box), 1e-9)),
  }
}

export function fingerprintScore(a: EdgeFingerprint, b: EdgeFingerprint): number {
  if (a.kind !== b.kind) return Number.POSITIVE_INFINITY
  return distance(a.mid, b.mid) + (1 - Math.abs(dot(a.dir, b.dir))) + LENGTH_WEIGHT * Math.abs(a.length - b.length)
}

interface Pair { readonly f: number; readonly e: number; readonly score: number }

/** Finds each remembered edge among the current edges: best matches first, each edge used at most once. */
export function matchFingerprints(
  fingerprints: readonly EdgeFingerprint[], infos: readonly EdgeInfo[], box: Box,
): { matched: ReadonlySet<number>; lost: number } {
  const current = infos.map((info) => fingerprintOf(info, box))
  const pairs: Pair[] = fingerprints
    .flatMap((fp, f) => current.flatMap((c, e) => (infos[e]?.seam ? [] : [{ f, e, score: fingerprintScore(fp, c) }])))
    .filter((p) => p.score <= MATCH_THRESHOLD)
    .sort((a, b) => a.score - b.score)
  const used = pairs.reduce(
    (acc, p) => (acc.f.has(p.f) || acc.e.has(p.e) ? acc : { f: new Set([...acc.f, p.f]), e: new Set([...acc.e, p.e]) }),
    { f: new Set<number>(), e: new Set<number>() },
  )
  return { matched: used.e, lost: fingerprints.length - used.f.size }
}

export function selectedEdges(
  selection: EdgeSelection, infos: readonly EdgeInfo[], box: Box,
): { indices: ReadonlySet<number>; lost: number } {
  if (selection.by === 'picked') {
    const { matched, lost } = matchFingerprints(selection.fingerprints, infos, box)
    return { indices: matched, lost }
  }
  const indices = new Set(infos.flatMap((info, i) => (matchesDescription(info, selection.which, box) ? [i] : [])))
  return { indices, lost: 0 }
}
