import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { printerById } from '../printers/printers'
import { createBloKadeStore } from '../store/store'
import { putOnPlateIds, putSelectionOnPlate } from './put-on-plate'
import { boxMesh } from './testing/meshes'

function setup() {
  const doc = [
    createShapeNode({ id: 'a', shapeType: 'box', name: 'A', params: {}, color: '#f00', position: [0, 0, 9] }),
    createShapeNode({ id: 'b', shapeType: 'box', name: 'B', params: {}, color: '#f00', position: [300, 0, 5] }),
  ].reduce((d, n) => addNode(d, n), createEmptyDocument())
  const store = createBloKadeStore({ designId: 'd', doc })
  const mesh = boxMesh(20, 20, 20)
  store.getState().applyBuild('d', { nodes: { a: { status: 'ok', mesh }, b: { status: 'ok', mesh } } })
  return store
}

const positionOf = (store: ReturnType<typeof setup>, id: string) => store.getState().history.present.nodes[id]?.transform.position

describe('putSelectionOnPlate', () => {
  it('puts the selection on the plate as one undo step', () => {
    const store = setup()
    store.getState().select(['a'])
    const before = store.getState().history.past.length
    putSelectionOnPlate(store, null)
    expect(positionOf(store, 'a')?.[2]).toBe(0)
    expect(store.getState().history.past.length).toBe(before + 1)
    store.getState().undo()
    expect(positionOf(store, 'a')?.[2]).toBe(9)
  })

  it('does nothing with no selection', () => {
    const store = setup()
    const history = store.getState().history
    putSelectionOnPlate(store, null)
    expect(store.getState().history).toBe(history)
  })
})

describe('putOnPlateIds', () => {
  it('brings the given parts back inside the printer plate', () => {
    const store = setup()
    putOnPlateIds(store, ['b'], printerById('bambu-a1-mini'))
    const [x] = positionOf(store, 'b') ?? []
    expect(x).toBeLessThanOrEqual(90)
    expect(positionOf(store, 'a')?.[2]).toBe(9)
  })
})
