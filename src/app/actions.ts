import { createShapeNode, pickColor } from '../document/factory'
import {
  addNode, DocumentOpError, duplicateNodes, groupNodes, removeNodes, setGridSnap, setMode, ungroupNode,
} from '../document/ops'
import type { BloKadeDocument, NodeId } from '../document/types'
import { defaultParams } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'
import type { BloKadeStore, ToolMode } from '../store/store'
import { nextSelection } from './selection'

export interface Actions {
  addShape(pluginId: string): void
  deleteSelection(): void
  duplicateSelection(): void
  groupSelection(): void
  ungroupSelection(): void
  toggleHole(): void
  selectNode(id: NodeId, additive: boolean): void
  clearSelection(): void
  /** Esc: stop choosing a workplane if that's happening (keeping the current one), otherwise deselect. */
  cancel(): void
  setTool(tool: ToolMode): void
  setGridSnap(gridSnap: number): void
  toggleWorkplanePicking(): void
  resetWorkplane(): void
  undo(): void
  redo(): void
}

/** Runs an op that also returns a value; DocumentOpErrors become notices. */
function run<T>(store: BloKadeStore, op: (doc: BloKadeDocument) => { doc: BloKadeDocument; value: T }): T | undefined {
  const state = store.getState()
  try {
    const { doc, value } = op(state.history.present)
    state.apply(() => doc)
    return value
  } catch (error) {
    if (!(error instanceof DocumentOpError)) throw error
    state.notify(error.message)
    return undefined
  }
}

export function createActions(store: BloKadeStore, registry: PluginRegistry): Actions {
  const state = () => store.getState()
  const selectIf = (ids: readonly NodeId[] | undefined): void => {
    if (ids) state().select(ids)
  }

  return {
    addShape: (pluginId) => {
      const plugin = registry.get(pluginId)
      if (!plugin) {
        state().notify(`BloKade doesn't have a "${pluginId}" shape.`)
        return
      }
      const color = pickColor(Object.keys(state().history.present.nodes).length)
      const workplane = state().workplane
      const node = createShapeNode({
        shapeType: plugin.id, name: plugin.name, params: defaultParams(plugin), color,
        position: workplane?.origin, rotation: workplane?.rotation,
      })
      selectIf(run(store, (doc) => ({ doc: addNode(doc, node), value: [node.id] })))
    },
    deleteSelection: () => {
      const ids = state().selection
      if (ids.length > 0) state().apply((doc) => removeNodes(doc, ids))
    },
    duplicateSelection: () => {
      const ids = state().selection
      if (ids.length === 0) return
      selectIf(run(store, (doc) => {
        const result = duplicateNodes(doc, ids)
        return { doc: result.doc, value: result.newIds }
      }))
    },
    groupSelection: () => selectIf(run(store, (doc) => {
      const result = groupNodes(doc, state().selection)
      return { doc: result.doc, value: [result.groupId] }
    })),
    ungroupSelection: () => {
      const [id, ...rest] = state().selection
      if (!id || rest.length > 0) {
        state().notify('Pick one group to ungroup.')
        return
      }
      selectIf(run(store, (doc) => {
        const result = ungroupNode(doc, id)
        return { doc: result.doc, value: result.childIds }
      }))
    },
    toggleHole: () => {
      const { selection, history } = state()
      if (selection.length === 0) return
      const nodes = history.present.nodes
      const allHoles = selection.every((id) => Object.hasOwn(nodes, id) && nodes[id]?.mode === 'hole')
      state().apply((doc) => setMode(doc, selection, allHoles ? 'solid' : 'hole'))
    },
    selectNode: (id, additive) => state().select(nextSelection(state().selection, id, additive)),
    clearSelection: () => state().select([]),
    cancel: () => (state().pickingWorkplane ? state().setPickingWorkplane(false) : state().select([])),
    setTool: (tool) => state().setTool(tool),
    setGridSnap: (gridSnap) => state().apply((doc) => setGridSnap(doc, gridSnap)),
    toggleWorkplanePicking: () => state().setPickingWorkplane(!state().pickingWorkplane),
    resetWorkplane: () => state().setWorkplane(null),
    undo: () => state().undo(),
    redo: () => state().redo(),
  }
}
