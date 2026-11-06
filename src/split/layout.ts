import type { Cut } from './types'

type Span = readonly [number, number]

/** How far past the model a corner cell's box reaches, mm. */
const PAD = 1

export interface Bounds { readonly min: readonly number[]; readonly max: readonly number[] }

/** One grid cell's box in model x and y. Index is row-major from the front-left (−x, −y). */
export interface Cell { readonly index: number; readonly x: Span; readonly y: Span }

/** The stretch of one cut between two neighbouring pieces. */
export interface Segment {
  readonly cutIndex: number
  readonly cut: Cut
  readonly along: Span
  readonly minus: number // cell index on the − side
  readonly plus: number // cell index on the + side
}

export interface Layout {
  readonly cols: number
  readonly rows: number
  readonly cells: readonly Cell[]
  /** Edges on each axis: model edge, then each cut in order, then model edge. */
  readonly xEdges: readonly number[]
  readonly yEdges: readonly number[]
  readonly xCuts: readonly number[] // indices into cuts, in order of position
  readonly yCuts: readonly number[]
}

function cutsOn(cuts: readonly Cut[], axis: Cut['axis']): number[] {
  return cuts
    .map((cut, index) => ({ cut, index }))
    .filter(({ cut }) => cut.axis === axis)
    .sort((a, b) => a.cut.at - b.cut.at)
    .map(({ index }) => index)
}

function edges(cuts: readonly Cut[], order: readonly number[], lo: number, hi: number): number[] {
  return [lo, ...order.map((i) => cuts[i]?.at ?? lo), hi]
}

/** A cell's span: inner edges are cuts, outer edges reach just past the model. */
function span(list: readonly number[], i: number): Span {
  const lo = i === 0 ? (list[0] ?? 0) - PAD : (list[i] ?? 0)
  const hi = i === list.length - 2 ? (list[i + 1] ?? 0) + PAD : (list[i + 1] ?? 0)
  return [lo, hi]
}

/** Cells and cut order for a set of cuts over a model's bounds. */
export function layoutGrid(cuts: readonly Cut[], bounds: Bounds): Layout {
  const xCuts = cutsOn(cuts, 'x')
  const yCuts = cutsOn(cuts, 'y')
  const xEdges = edges(cuts, xCuts, bounds.min[0] ?? 0, bounds.max[0] ?? 0)
  const yEdges = edges(cuts, yCuts, bounds.min[1] ?? 0, bounds.max[1] ?? 0)
  const cols = xCuts.length + 1
  const rows = yCuts.length + 1
  const cells = Array.from({ length: cols * rows }, (_, index): Cell => ({
    index,
    x: span(xEdges, index % cols),
    y: span(yEdges, Math.floor(index / cols)),
  }))
  return { cols, rows, cells, xEdges, yEdges, xCuts, yCuts }
}

/** The span between edges i and i+1, pulled in by `reach` at ends that meet another cut. */
function inner(list: readonly number[], i: number, reach: number): Span {
  const lo = (list[i] ?? 0) + (i > 0 ? reach : 0)
  const hi = (list[i + 1] ?? 0) - (i + 1 < list.length - 1 ? reach : 0)
  return [lo, hi]
}

/** Every cut split into one segment per pair of neighbouring pieces. */
export function segmentsOf(layout: Layout, cuts: readonly Cut[], reach: number): Segment[] {
  const { cols, rows, xEdges, yEdges } = layout
  const xSegments = layout.xCuts.flatMap((cutIndex, k) =>
    Array.from({ length: rows }, (_, r): Segment => ({
      cutIndex,
      cut: cuts[cutIndex] as Cut,
      along: inner(yEdges, r, reach),
      minus: r * cols + k,
      plus: r * cols + k + 1,
    })),
  )
  const ySegments = layout.yCuts.flatMap((cutIndex, k) =>
    Array.from({ length: cols }, (_, c): Segment => ({
      cutIndex,
      cut: cuts[cutIndex] as Cut,
      along: inner(xEdges, c, reach),
      minus: k * cols + c,
      plus: (k + 1) * cols + c,
    })),
  )
  return [...xSegments, ...ySegments]
}
