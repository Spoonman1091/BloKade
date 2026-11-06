import { MARGIN, MAX_GRID, TAB_LENGTH, TONGUE_OUT } from './constants'
import type { Axis2, Cut, GridPlan, JointStyle, Plate } from './types'

/** Joint room per cut edge for each joint style, mm. */
export const JOINT_RESERVE: Readonly<Record<JointStyle, number>> = { tabs: TAB_LENGTH, tongue: TONGUE_OUT, none: 0 }

/** True when a piece of x by y mm fits the plate with a margin each side, either way round. */
export function fitsPlate(x: number, y: number, plate: Plate): boolean {
  const w = plate.width - 2 * MARGIN
  const d = plate.depth - 2 * MARGIN
  return (x <= w && y <= d) || (y <= w && x <= d)
}

/** True when a piece of x by y mm fits the plate only when turned 90 degrees. */
export function turnedToFit(x: number, y: number, plate: Plate): boolean {
  const fitsUpright = x <= plate.width - 2 * MARGIN && y <= plate.depth - 2 * MARGIN
  return !fitsUpright && fitsPlate(x, y, plate)
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

/** One grid cell's longest reach on x and y (mm), counting joint room on its cut edges. Cell is row-major from the front-left. */
export interface PieceExtent { readonly cell: number; readonly x: number; readonly y: number }

/** The cuts' positions on one axis, smallest first, with the model's two ends. */
function axisEdges(cuts: readonly Cut[], axis: Axis2, length: number): number[] {
  return [-length / 2, ...cuts.filter((c) => c.axis === axis).map((c) => c.at).sort((a, b) => a - b), length / 2]
}

/** How long each piece would be for these cut positions, before any are made. */
export function pieceExtents(grid: GridPlan, size: { readonly width: number; readonly depth: number }, reserve: number): PieceExtent[] {
  const xs = axisEdges(grid.cuts, 'x', size.width)
  const ys = axisEdges(grid.cuts, 'y', size.depth)
  const [cols, rows] = [xs.length - 1, ys.length - 1]
  return Array.from({ length: cols * rows }, (_, cell): PieceExtent => {
    const [c, r] = [cell % cols, Math.floor(cell / cols)]
    return {
      cell,
      x: (xs[c + 1] ?? 0) - (xs[c] ?? 0) + reserve * cutEdges(c, cols),
      y: (ys[r + 1] ?? 0) - (ys[r] ?? 0) + reserve * cutEdges(r, rows),
    }
  })
}

/** The cells whose piece would be too big for the plate with these cut positions. */
export function misfitCells(grid: GridPlan, size: { readonly width: number; readonly depth: number }, plate: Plate, reserve: number): number[] {
  return pieceExtents(grid, size, reserve).filter((e) => !fitsPlate(e.x, e.y, plate)).map((e) => e.cell)
}
