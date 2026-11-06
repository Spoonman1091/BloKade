import { MARGIN, MAX_GRID } from './constants'
import type { Axis2, Cut, GridPlan, Plate } from './types'

/** True when a piece of x by y mm fits the plate with a margin each side, either way round. */
export function fitsPlate(x: number, y: number, plate: Plate): boolean {
  const w = plate.width - 2 * MARGIN
  const d = plate.depth - 2 * MARGIN
  return (x <= w && y <= d) || (y <= w && x <= d)
}

/** The longest a piece can be on one axis when its other side is `other` long. */
function maxExtent(other: number, plate: Plate): number {
  const w = plate.width - 2 * MARGIN
  const d = plate.depth - 2 * MARGIN
  return Math.max(other <= d ? w : -Infinity, other <= w ? d : -Infinity)
}

/** How many of a piece's edges on one axis are cuts. */
function cutEdges(index: number, count: number): number {
  return (index > 0 ? 1 : 0) + (index < count - 1 ? 1 : 0)
}

/** The largest extent over the pieces along one axis, including joint room. */
function worstExtent(size: number, count: number, reserve: number): number {
  let worst = 0
  for (let i = 0; i < count; i++) worst = Math.max(worst, size / count + reserve * cutEdges(i, count))
  return worst
}

function allFit(width: number, depth: number, cols: number, rows: number, plate: Plate, reserve: number): boolean {
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const ex = width / cols + reserve * cutEdges(c, cols)
      const ey = depth / rows + reserve * cutEdges(r, rows)
      if (!fitsPlate(ex, ey, plate)) return false
    }
  }
  return true
}

function axisCuts(axis: Axis2, size: number, count: number, otherWorst: number, plate: Plate, reserve: number): Cut[] {
  const cuts: Cut[] = []
  const step = size / count
  const limit = maxExtent(otherWorst, plate)
  for (let i = 1; i < count; i++) {
    const at = -size / 2 + i * step
    const prev = -size / 2 + (i - 1) * step
    const next = -size / 2 + (i + 1) * step
    const leftRoom = limit - reserve * (cutEdges(i - 1, count))
    const rightRoom = limit - reserve * (cutEdges(i, count))
    cuts.push({ axis, min: next - rightRoom, max: prev + leftRoom, at })
  }
  return cuts
}

/**
 * Plans the fewest pieces that fit the plate. `reserve` is joint room per cut edge
 * (TAB_LENGTH, TONGUE_OUT or 0). Returns null if more than MAX_GRID x MAX_GRID are needed.
 */
export function planGrid(width: number, depth: number, plate: Plate, reserve: number): GridPlan | null {
  const longerIsX = width >= depth
  const candidates: { cols: number; rows: number }[] = []
  for (let cols = 1; cols <= MAX_GRID; cols++) {
    for (let rows = 1; rows <= MAX_GRID; rows++) candidates.push({ cols, rows })
  }
  const longCuts = (g: { cols: number; rows: number }) => (longerIsX ? g.cols : g.rows) - 1
  candidates.sort(
    (a, b) => a.cols * a.rows - b.cols * b.rows || longCuts(a) - longCuts(b) || a.cols - b.cols,
  )
  const found = candidates.find((g) => allFit(width, depth, g.cols, g.rows, plate, reserve))
  if (!found) return null
  const { cols, rows } = found
  const xCuts = axisCuts('x', width, cols, worstExtent(depth, rows, reserve), plate, reserve)
  const yCuts = axisCuts('y', depth, rows, worstExtent(width, cols, reserve), plate, reserve)
  return { cols, rows, cuts: [...xCuts, ...yCuts] }
}
