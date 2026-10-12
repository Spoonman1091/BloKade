import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { createBloKadeStore } from '../store/store'
import { alignSelection } from './align-selection'
import { boxMesh } from './testing/meshes'

describe('alignSelection', () => {
  it('lines up the selected parts using their meshes', () => {
    const doc = [
      createShapeNode({ id: 'a', shapeType: 'box', name: 'A', params: {}, color: '#f00' }),
      createShapeNode({ id: 'b', shapeType: 'box', name: 'B', params: {}, color: '#f00', position: [0, 0, 7] }),
    ].reduce((d, n) => addNode(d, n), createEmptyDocument())
    const store = createBloKadeStore({ designId: 'd', doc })
    const mesh = boxMesh(20, 20, 20)
    store.getState().applyBuild('d', { nodes: { a: { status: 'ok', mesh }, b: { status: 'ok', mesh } } })
    store.getState().select(['a', 'b'])
    alignSelection(store, 2, 'min')
    expect(store.getState().history.present.nodes.b?.transform.position).toEqual([0, 0, 0])
  })

  it('explains when there is nothing to line up', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    alignSelection(store, 0, 'min')
    expect(store.getState().notice).toContain('Pick two or more parts')
  })
})
