import { putOnPlate } from '../document/plate'
import type { NodeId } from '../document/types'
import type { Printer } from '../printers/printers'
import type { BloKadeStore } from '../store/store'
import { topLevelBoxes } from '../viewport/bounds'

/** Puts the given parts on the plate using the boxes of the meshes on screen. Makes no undo step if nothing moves. */
export function putOnPlateIds(store: BloKadeStore, ids: readonly NodeId[], printer: Printer | null): void {
  const { history, meshes, apply } = store.getState()
  const boxes = Object.fromEntries(topLevelBoxes(history.present, meshes).map((b) => [b.id, b.box] as const))
  apply((doc) => putOnPlate(doc, boxes, ids, printer))
}

/** Puts the current selection on the plate. */
export function putSelectionOnPlate(store: BloKadeStore, printer: Printer | null): void {
  putOnPlateIds(store, store.getState().selection, printer)
}
