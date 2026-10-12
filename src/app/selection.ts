import type { NodeId } from '../document/types'

export const toggleInSelection = (selection: readonly NodeId[], id: NodeId): NodeId[] =>
  selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]

export const nextSelection = (selection: readonly NodeId[], id: NodeId, additive: boolean): NodeId[] =>
  additive ? toggleInSelection(selection, id) : [id]
