import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d'
import { bareStretches, tabOutlines, tongueOutline } from './joints'
import type { Segment } from './layout'

/** How far a tab pocket reaches past the base's faces, so it cuts cleanly through, mm. */
const POCKET_CLEAR = 1

/** Material added to, or taken from, one piece. The receiver frees `solid`. */
export interface Edit { readonly piece: number; readonly kind: 'add' | 'remove'; readonly solid: Manifold }

export interface JointContext {
  readonly wasm: ManifoldToplevel
  readonly solid: Manifold
  readonly base: CrossSection
  readonly raised: CrossSection
  readonly baseThickness: number
  readonly fitGap: number
  readonly reach: number
}

/** The outline as a prism from z0 to z1. Caller frees it. */
export function prism(section: CrossSection, z0: number, z1: number): Manifold {
  const raw = section.extrude(z1 - z0)
  try {
    return raw.translate([0, 0, z0])
  } finally {
    raw.delete()
  }
}

/** The model's own material inside the outline between z0 and z1. Caller frees it. */
function material(ctx: JointContext, outline: CrossSection, z0: number, z1: number): Manifold {
  const shape = prism(outline, z0, z1)
  try {
    return shape.intersect(ctx.solid)
  } finally {
    shape.delete()
  }
}

/** The outline grown by the fit gap, as a prism from z0 to z1. Caller frees it. */
function clearance(ctx: JointContext, outline: CrossSection, z0: number, z1: number): Manifold {
  const grown = outline.offset(ctx.fitGap, 'Miter')
  try {
    return prism(grown, z0, z1)
  } finally {
    grown.delete()
  }
}

function tabEdits(ctx: JointContext, segment: Segment, stretches: readonly (readonly [number, number])[]): Edit[] {
  const tabs = tabOutlines(ctx.wasm, segment.cut, stretches)
  try {
    return tabs.flatMap(({ owner, outline }): Edit[] => {
      const [mine, theirs] = owner === -1 ? [segment.minus, segment.plus] : [segment.plus, segment.minus]
      return [
        { piece: mine, kind: 'add', solid: material(ctx, outline, 0, ctx.baseThickness) },
        { piece: theirs, kind: 'remove', solid: clearance(ctx, outline, -POCKET_CLEAR, ctx.baseThickness + POCKET_CLEAR) },
      ]
    })
  } finally {
    tabs.forEach((t) => t.outline.delete())
  }
}

function tongueEdits(ctx: JointContext, segment: Segment, stretches: readonly (readonly [number, number])[]): Edit[] {
  const low = ctx.baseThickness / 3
  const high = (2 * ctx.baseThickness) / 3
  return stretches.flatMap((stretch): Edit[] => {
    const footprint = tongueOutline(ctx.wasm, segment.cut, stretch)
    try {
      return [
        { piece: segment.minus, kind: 'add', solid: material(ctx, footprint, low, high) },
        { piece: segment.plus, kind: 'remove', solid: clearance(ctx, footprint, low - ctx.fitGap, high + ctx.fitGap) },
      ]
    } finally {
      footprint.delete()
    }
  })
}

/** The joint material for one segment of a cut, only where the base is bare. Empty when none fits. */
export function segmentEdits(ctx: JointContext, segment: Segment, joint: 'tabs' | 'tongue'): Edit[] {
  if (segment.along[1] <= segment.along[0]) return []
  const stretches = bareStretches(ctx.wasm, ctx.base, ctx.raised, segment.cut, segment.along, ctx.reach)
  return joint === 'tabs' ? tabEdits(ctx, segment, stretches) : tongueEdits(ctx, segment, stretches)
}
