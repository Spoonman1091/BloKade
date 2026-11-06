import type { CrossSection, ManifoldToplevel } from 'manifold-3d'
import { TAB_LENGTH, TAB_NECK, TAB_SPACING, TAB_TIP, TONGUE_OUT } from './constants'
import type { Cut } from './types'

type Stretch = readonly [number, number]
type Point = readonly [number, number]

/** How far apart bareness is sampled along a cut, mm. */
const SAMPLE_STEP = 1
const AREA_TOLERANCE = 1e-3

/** (across, along) in the cut's own frame -> model (x, y). Across is x for an x cut, y for a y cut. */
function toModel(cut: Cut, across: number, along: number): [number, number] {
  return cut.axis === 'x' ? [cut.at + across, along] : [along, cut.at + across]
}

/** Counter-clockwise outline of cut-frame points, as a CrossSection. Caller frees it. */
function outlineOf(wasm: ManifoldToplevel, cut: Cut, points: readonly Point[]): CrossSection {
  const mapped = points.map(([across, along]) => toModel(cut, across, along))
  let twice = 0
  mapped.forEach(([x, y], i) => {
    const [nx, ny] = mapped[(i + 1) % mapped.length] ?? [x, y]
    twice += x * ny - nx * y
  })
  return new wasm.CrossSection([twice < 0 ? [...mapped].reverse() : mapped])
}

/** True when the square of side 2*reach around the point is all base and touches no raised detail. */
function isBare(wasm: ManifoldToplevel, base: CrossSection, raised: CrossSection, cut: Cut, along: number, reach: number): boolean {
  const [cx, cy] = toModel(cut, 0, along)
  const square = wasm.CrossSection.square([2 * reach, 2 * reach], true).translate([cx, cy])
  const inBase = base.intersect(square)
  const touched = raised.intersect(square)
  try {
    return Math.abs(inBase.area() - 4 * reach * reach) < AREA_TOLERANCE && touched.area() < AREA_TOLERANCE
  } finally {
    square.delete()
    inBase.delete()
    touched.delete()
  }
}

/** Positions along the cut (the other axis) where a joint fits on bare base, both sides of the line. Increasing order. */
export function bareStretches(
  wasm: ManifoldToplevel,
  base: CrossSection,
  raised: CrossSection,
  cut: Cut,
  along: readonly [number, number],
  reach: number,
): readonly Stretch[] {
  const stretches: Stretch[] = []
  let start: number | null = null
  let last = 0
  const count = Math.floor((along[1] - along[0]) / SAMPLE_STEP + 1e-9)
  for (let k = 0; k <= count; k++) {
    const p = along[0] + k * SAMPLE_STEP
    if (isBare(wasm, base, raised, cut, p, reach)) {
      if (start === null) start = p
      last = p
    } else if (start !== null) {
      stretches.push([start, last])
      start = null
    }
  }
  if (start !== null) stretches.push([start, last])
  return stretches
}

function dovetail(wasm: ManifoldToplevel, cut: Cut, centre: number, direction: -1 | 1): CrossSection {
  const n = TAB_NECK / 2
  const t = TAB_TIP / 2
  const l = TAB_LENGTH * direction
  return outlineOf(wasm, cut, [[0, centre - n], [l, centre - t], [l, centre + t], [0, centre + n]])
}

/**
 * Tab outlines centred on the cut, owned alternately by the - and + side (index 0 is the - side).
 * An owner -1 tab sticks out toward +axis, an owner +1 tab toward -axis: into the neighbour.
 * Callers free each outline.
 */
export function tabOutlines(
  wasm: ManifoldToplevel,
  cut: Cut,
  stretches: readonly Stretch[],
): readonly { readonly owner: -1 | 1; readonly outline: CrossSection }[] {
  const tabs: { owner: -1 | 1; outline: CrossSection }[] = []
  for (const [from, to] of stretches) {
    for (let centre = from + TAB_SPACING / 3; centre + TAB_TIP / 2 <= to + 1e-9; centre += TAB_SPACING) {
      const owner = tabs.length % 2 === 0 ? -1 : 1
      tabs.push({ owner, outline: dovetail(wasm, cut, centre, owner === -1 ? 1 : -1) })
    }
  }
  return tabs
}

/**
 * The 2D footprint of a tongue: the stretch long, TONGUE_OUT deep, on the + side of the cut.
 * The - side piece (owner -1) carries the tongue; its height (centred third of the base) is applied later.
 * Caller frees it.
 */
export function tongueOutline(wasm: ManifoldToplevel, cut: Cut, stretch: Stretch): CrossSection {
  return outlineOf(wasm, cut, [[0, stretch[0]], [TONGUE_OUT, stretch[0]], [TONGUE_OUT, stretch[1]], [0, stretch[1]]])
}
