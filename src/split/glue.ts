import type { Segment } from './layout'
import type { GlueSegment } from './types'

export interface Glue { readonly glueCuts: readonly number[]; readonly glueSegments: readonly GlueSegment[] }

/**
 * Where the pieces must be glued: every stretch of a cut between two pieces that got no joint.
 * `segments` are the full stretches (not pulled in for joint room); `joined` holds the indices of those
 * that got a joint; `filled` the cells that hold material (a stretch beside an empty cell needs nothing).
 */
export function glueOf(segments: readonly Segment[], joined: ReadonlySet<number>, filled: ReadonlySet<number>): Glue {
  const glueSegments = segments.flatMap((segment, i): GlueSegment[] => {
    const [from, to] = segment.along
    const between = filled.has(segment.minus) && filled.has(segment.plus)
    return between && to > from && !joined.has(i) ? [{ cut: segment.cutIndex, from, to }] : []
  })
  const glueCuts = [...new Set(glueSegments.map((g) => g.cut))].sort((a, b) => a - b)
  return { glueCuts, glueSegments }
}
