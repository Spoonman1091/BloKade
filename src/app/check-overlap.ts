import { rootAncestorOf } from '../document/tree'
import type { BloKadeDocument, NodeId } from '../document/types'
import type { GeometryClient } from '../geometry/client'
import type { BloKadeStore } from '../store/store'

const PICK_TWO = 'Select two parts (Shift-click) to check if they overlap.'
const FAILED = "BloKade couldn't check that. Try again."

/** The two different top-level parts covered by the selection, or null. */
export function overlapPair(doc: BloKadeDocument, selection: readonly NodeId[]): [NodeId, NodeId] | null {
  const roots = [...new Set(selection.map((id) => rootAncestorOf(doc, id)))].filter((id): id is NodeId => id !== undefined)
  return roots.length === 2 && roots[0] && roots[1] ? [roots[0], roots[1]] : null
}

/** Checks the two selected parts and stores the result, unless the design or selection changed meanwhile. */
export async function checkOverlap(store: BloKadeStore, client: Pick<GeometryClient, 'overlap'>): Promise<void> {
  const { history, selection } = store.getState()
  const doc = history.present
  const pair = overlapPair(doc, selection)
  if (!pair) {
    store.getState().notify(PICK_TWO)
    return
  }
  const stillCurrent = (): boolean => store.getState().history.present === doc && store.getState().selection === selection
  try {
    const result = await client.overlap(doc, pair[0], pair[1])
    if (stillCurrent()) store.getState().setOverlap({ doc, selection, result })
  } catch (error) {
    if (stillCurrent()) store.getState().notify(error instanceof Error && error.message ? error.message : FAILED)
  }
}
