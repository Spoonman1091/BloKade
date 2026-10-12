import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { createActions } from './actions'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  return { store, actions: createActions(store, registry), doc: () => store.getState().history.present }
}

describe('actions', () => {
  it('adds a shape with default sizes and selects it', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    const [id] = doc().root
    expect(store.getState().selection).toEqual([id])
    expect(doc().nodes[id as string]).toMatchObject({ shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 } })
  })

  it('explains an unknown shape', () => {
    const { store, actions } = setup()
    actions.addShape('spaceship')
    expect(store.getState().notice).toContain('"spaceship"')
  })

  it('groups the selection and selects the group', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.addShape('cylinder')
    store.getState().select(doc().root)
    actions.groupSelection()
    expect(doc().root).toHaveLength(1)
    expect(store.getState().selection).toEqual(doc().root)
  })

  it('explains grouping a single part', () => {
    const { store, actions } = setup()
    actions.addShape('box')
    actions.groupSelection()
    expect(store.getState().notice).toBe('Pick at least two parts to group.')
  })

  it('ungroups and selects the children', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.addShape('sphere')
    const parts = doc().root
    store.getState().select(parts)
    actions.groupSelection()
    actions.ungroupSelection()
    expect(doc().root).toEqual(parts)
    expect(store.getState().selection).toEqual(parts)
  })

  it('asks for one group when ungrouping something else', () => {
    const { store, actions } = setup()
    actions.ungroupSelection()
    expect(store.getState().notice).toBe('Pick one group to ungroup.')
  })

  it('duplicates and deletes the selection', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.duplicateSelection()
    expect(doc().root).toHaveLength(2)
    expect(store.getState().selection).toEqual([doc().root[1]])
    actions.deleteSelection()
    expect(doc().root).toHaveLength(1)
  })

  it('toggles holes: mixed becomes all holes, all holes become solid', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.addShape('box')
    store.getState().select(doc().root)
    actions.toggleHole()
    expect(doc().root.map((id) => doc().nodes[id]?.mode)).toEqual(['hole', 'hole'])
    actions.toggleHole()
    expect(doc().root.map((id) => doc().nodes[id]?.mode)).toEqual(['solid', 'solid'])
  })

  it('selects with and without the modifier key, and changes settings', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.addShape('box')
    const [a, b] = doc().root as [string, string]
    actions.selectNode(a, false)
    actions.selectNode(b, true)
    expect(store.getState().selection).toEqual([a, b])
    actions.clearSelection()
    expect(store.getState().selection).toEqual([])
    actions.setTool('rotate')
    expect(store.getState().tool).toBe('rotate')
    actions.setGridSnap(0.5)
    expect(doc().settings.gridSnap).toBe(0.5)
    actions.undo()
    expect(doc().settings.gridSnap).toBe(1)
    actions.redo()
    expect(doc().settings.gridSnap).toBe(0.5)
  })

  it('puts new shapes on the workplane', () => {
    const { store, actions, doc } = setup()
    store.getState().setWorkplane({ origin: [1, 2, 3], rotation: [0, 90, 0] })
    actions.addShape('box')
    const [id] = doc().root
    expect(doc().nodes[id as string]?.transform).toEqual({ position: [1, 2, 3], rotation: [0, 90, 0] })
  })

  it('toggles workplane picking and goes back to the ground', () => {
    const { store, actions } = setup()
    actions.toggleWorkplanePicking()
    expect(store.getState().pickingWorkplane).toBe(true)
    actions.toggleWorkplanePicking()
    expect(store.getState().pickingWorkplane).toBe(false)
    store.getState().setWorkplane({ origin: [0, 0, 5], rotation: [0, 0, 0] })
    actions.resetWorkplane()
    expect(store.getState().workplane).toBeNull()
  })
})
