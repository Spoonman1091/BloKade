import type { BloKadeDocument, NodeId } from '../document/types'
import type { OverlapResult } from '../geometry/types'
import type { BloKadeState, OverlapView } from './store'

export interface OverlapInputs {
  readonly overlap: OverlapView | null
  readonly present: BloKadeDocument
  readonly selection: readonly NodeId[]
}

/** The overlap result to show: only while the design and selection are exactly the ones that were checked. */
export function visibleOverlap({ overlap, present, selection }: OverlapInputs): OverlapResult | null {
  return overlap && overlap.doc === present && overlap.selection === selection ? overlap.result : null
}

/** visibleOverlap for the whole store state. */
export const visibleOverlapOf = (s: BloKadeState): OverlapResult | null =>
  visibleOverlap({ overlap: s.overlap, present: s.history.present, selection: s.selection })
