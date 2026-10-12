import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { MAX_CARRIED_SHAPES } from '../document/types'
import { TOO_MANY_SHAPES } from '../kade/carried'
import { codeHash } from '../kade/hash'
import { buildShapeRegistry } from '../kade/shape-registry'
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

  it('adds a kit as one undo step and selects its parts (Review Focus 2)', () => {
    const { store, actions } = setup()
    const before = store.getState().history.present
    actions.addKit('peg-socket')
    expect(store.getState().selection).toHaveLength(2)
    actions.undo()
    expect(store.getState().history.present).toBe(before)
    actions.addKit('nope')
    expect(store.getState().notice).toBe('BloKade doesn\'t have a "nope" kit.')
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

  it('Escape stops workplane picking first, and otherwise clears the selection', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    const [id] = doc().root as [string]
    store.getState().setWorkplane({ origin: [0, 0, 5], rotation: [0, 0, 0] })
    actions.toggleWorkplanePicking()
    actions.cancel()
    expect(store.getState().pickingWorkplane).toBe(false)
    expect(store.getState().workplane).toEqual({ origin: [0, 0, 5], rotation: [0, 0, 0] })
    expect(store.getState().selection).toEqual([id])
    actions.cancel()
    expect(store.getState().selection).toEqual([])
  })

  it('Escape stops edge picking first, then workplane picking, then deselects', () => {
    const { store, actions } = setup()
    store.getState().setPickingEdges({ nodeId: 'a', modifierId: 'aaaaaaaa' })
    store.getState().apply((d) => addNode(d, createShapeNode({ id: 'a', shapeType: 'box', name: 'Box', params: {}, color: '#f00' })))
    store.getState().select(['a'])
    actions.cancel()
    expect(store.getState().pickingEdges).toBeNull()
    expect(store.getState().selection).toEqual(['a'])
    store.getState().setPickingWorkplane(true)
    actions.cancel()
    expect(store.getState().pickingWorkplane).toBe(false)
    expect(store.getState().selection).toEqual(['a'])
    actions.cancel()
    expect(store.getState().selection).toEqual([])
    expect(typeof actions.togglePickedEdge).toBe('function')
  })

  it('Escape clears an overlap result when it deselects', () => {
    const { store, actions } = setup()
    const s = store.getState()
    s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    actions.cancel()
    expect(store.getState().overlap).toBeNull()
  })
})

describe("adding Kade's shapes", () => {
  const code = "export default { name: 'Gear' }"
  const shapes = buildShapeRegistry({
    base: registry, library: [{ id: 'my-gear', name: 'Gear', code, updatedAt: 1 }], carried: {},
    results: { [codeHash(code)]: { ok: true, meta: { name: 'Gear', icon: '⚙️', params: { size: { type: 'mm', default: 40, label: 'Size' } } } } },
  })
  const codeOf = (id: string) => (id === 'my-gear' ? { name: 'Gear', code } : undefined)

  it('copies the code into the design with the part, as one undo step', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    const before = store.getState().history.present
    createActions(store, shapes, codeOf).addShape('my-gear')
    const doc = store.getState().history.present
    expect(doc.plugins).toEqual({ 'my-gear': { name: 'Gear', code } })
    expect(Object.values(doc.nodes)[0]).toMatchObject({ shapeType: 'my-gear', name: 'Gear', params: { size: 40 } })
    store.getState().undo()
    expect(store.getState().history.present).toBe(before)
  })
  it('adds the newest code again after the old part was deleted (and drops the old copy with it)', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    const actions = createActions(store, shapes, codeOf)
    actions.addShape('my-gear')
    actions.deleteSelection()
    expect(store.getState().history.present.plugins).toEqual({})
    createActions(store, shapes, () => ({ name: 'Gear', code: 'newer' })).addShape('my-gear')
    expect(store.getState().history.present.plugins['my-gear']?.code).toBe('newer')
  })
  it("names the shape, not its id, when the design's copy has a problem", () => {
    const gearPart = createShapeNode({ id: 'g', shapeType: 'my-gear', name: 'Gear', params: {}, color: '#fff' })
    const doc = addNode({ ...createEmptyDocument(), plugins: { 'my-gear': { name: 'Gear', code: 'broken' } } }, gearPart)
    const store = createBloKadeStore({ designId: 'd', doc })
    const carried = buildShapeRegistry({ base: registry, library: [], carried: doc.plugins, results: {} })
    createActions(store, carried, codeOf).addShape('my-gear')
    expect(store.getState().notice).toBe("This design's copy of Gear has a problem. Try the Use my newest version button.")
    expect(store.getState().history.present).toBe(doc)
  })
  it('keeps the version the design\'s parts already use', () => {
    const gearPart = createShapeNode({ id: 'g', shapeType: 'my-gear', name: 'Gear', params: {}, color: '#fff' })
    const doc = addNode({ ...createEmptyDocument(), plugins: { 'my-gear': { name: 'Gear', code: 'older' } } }, gearPart)
    const store = createBloKadeStore({ designId: 'd', doc })
    createActions(store, shapes, codeOf).addShape('my-gear')
    expect(store.getState().history.present.plugins['my-gear']?.code).toBe('older')
  })
  it('says so and adds nothing when the design carries too many shapes', () => {
    const plugins = Object.fromEntries(Array.from({ length: MAX_CARRIED_SHAPES }, (_, i) => [`my-${i}`, { name: 'X', code: 'x' }]))
    const doc = { ...createEmptyDocument(), plugins }
    const store = createBloKadeStore({ designId: 'd', doc })
    createActions(store, shapes, codeOf).addShape('my-gear')
    expect(store.getState().notice).toBe(TOO_MANY_SHAPES)
    expect(store.getState().history.present).toBe(doc)
  })
  it('adds the part without copying code when there is no code to carry', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    createActions(store, shapes, () => undefined).addShape('my-gear')
    const doc = store.getState().history.present
    expect(doc.plugins).toEqual({})
    expect(Object.values(doc.nodes)).toHaveLength(1)
  })
})
