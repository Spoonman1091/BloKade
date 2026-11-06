import type { CrossSection, Manifold } from 'manifold-3d'
import { BALANCE_WEIGHT, BASE_COVERAGE, BASE_STEP, RAISED_PROBE, SCORE_STEP } from './constants'
import type { Cut, GridPlan } from './types'

/** Half the width of the strip used to measure how much raised detail a cut crosses. */
const STRIP_HALF = 0.5
const BIG = 1e4

function sliceArea(solid: Manifold, z: number): number {
  const section = solid.slice(z)
  const area = section.area()
  section.delete()
  return area
}

/** True when a slice is (nearly) the footprint: not much smaller, as over raised detail, nor bigger, as up a dome. */
function matchesFootprint(area: number, footprint: number): boolean {
  return area >= BASE_COVERAGE * footprint && area * BASE_COVERAGE <= footprint
}

/** Slack for float32 vertex heights when comparing against the model top, mm. */
const TOP_TOLERANCE = 1e-4

/**
 * The height of the flat base: the last height whose slice still covers (nearly) the
 * whole footprint (and no more). A plain flat plate is all base, so it gets its full height.
 * Null only when the model has no flat base (the first step above the footprint already fails).
 */
export function findBaseThickness(solid: Manifold): number | null {
  const top = solid.boundingBox().max[2]
  const footprint = sliceArea(solid, BASE_STEP)
  let base: number | null = null
  // Step 1 is the footprint itself; the walk starts above it.
  for (let step = 2; step * BASE_STEP < top - BASE_STEP / 2; step++) {
    const z = step * BASE_STEP
    if (!matchesFootprint(sliceArea(solid, z), footprint)) break
    base = z
  }
  if (base === null) return null
  return base >= top - BASE_STEP - TOP_TOLERANCE ? top : base
}

/** The outline of everything that stands just above the base. Caller frees it. */
export function raisedOutline(solid: Manifold, baseThickness: number): CrossSection {
  return solid.slice(baseThickness + RAISED_PROBE)
}

function strip(cut: Cut, at: number): [number, number][] {
  const lo = at - STRIP_HALF
  const hi = at + STRIP_HALF
  return cut.axis === 'x'
    ? [[lo, -BIG], [hi, -BIG], [hi, BIG], [lo, BIG]]
    : [[-BIG, lo], [BIG, lo], [BIG, hi], [-BIG, hi]]
}

function crossedArea(outline: CrossSection, cut: Cut, at: number): number {
  const part = outline.intersect([strip(cut, at)])
  const area = part.area()
  part.delete()
  return area
}

/** Every SCORE_STEP inside the window, counted from the even position so it is always one of them. */
function candidates(cut: Cut): number[] {
  const found: number[] = []
  const first = Math.ceil((cut.min - cut.at) / SCORE_STEP - 1e-9)
  const last = Math.floor((cut.max - cut.at) / SCORE_STEP + 1e-9)
  for (let k = first; k <= last; k++) found.push(cut.at + k * SCORE_STEP)
  return found
}

function bestPosition(outline: CrossSection, cut: Cut): number {
  const even = cut.at
  let best = even
  let bestScore = Infinity
  for (const c of candidates(cut)) {
    const score = crossedArea(outline, cut, c) + BALANCE_WEIGHT * Math.abs(c - even)
    const better =
      score < bestScore - 1e-9 ||
      (Math.abs(score - bestScore) <= 1e-9 && (Math.abs(c) < Math.abs(best) || (Math.abs(c) === Math.abs(best) && c < best)))
    if (better) {
      best = c
      bestScore = score
    }
  }
  return best
}

/** Moves each cut inside its window to where it crosses the least raised detail. */
export function placeCuts(solid: Manifold, grid: GridPlan, baseThickness: number | null): GridPlan {
  if (baseThickness === null) return grid
  const outline = raisedOutline(solid, baseThickness)
  try {
    return { ...grid, cuts: grid.cuts.map((cut) => ({ ...cut, at: bestPosition(outline, cut) })) }
  } finally {
    outline.delete()
  }
}
