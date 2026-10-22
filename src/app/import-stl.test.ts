import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { cubeMesh } from '../geometry/testing/meshes'
import { createBloKadeStore } from '../store/store'
import { fitsBloKade, importPart, partNameFor, sizeInMm } from './import-stl'
import { preparedModel } from './testing/prepared'

const newStore = () => createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })

describe('import-stl', () => {
  it('converts sizes to mm', () => expect(sizeInMm([1, 2, 3], 'inches')).toEqual([25.4, 50.8, 76.2]))

  it('knows what fits', () => {
    expect(fitsBloKade([2000, 10, 10])).toBe(true)
    expect(fitsBloKade([2000.1, 10, 10])).toBe(false)
  })

  it('names the part after the file', () => {
    expect(partNameFor('Benchy.STL')).toBe('Benchy')
    expect(partNameFor('.stl')).toBe('Imported model')
    expect(partNameFor(`  ${'a'.repeat(80)}.stl`)).toHaveLength(60)
  })

  it('adds the part in one undo step, selected and in mm', () => {
    const store = newStore()
    importPart(store, 'cube.stl', preparedModel(cubeMesh(1)), 'cm')
    const state = store.getState()
    const id = state.selection[0] as string
    const node = state.history.present.nodes[id]
    expect(state.selection).toHaveLength(1)
    expect(node).toMatchObject({ name: 'cube', shapeType: 'imported', params: { width: 10, depth: 10, height: 10 } })
    state.undo()
    expect(Object.keys(store.getState().history.present.nodes)).toHaveLength(0)
  })

  it('tells the user when the design already has 20 models', () => {
    const store = newStore()
    for (let i = 1; i <= 21; i += 1) importPart(store, `m${i}.stl`, preparedModel(cubeMesh(i)), 'mm')
    expect(Object.keys(store.getState().history.present.models)).toHaveLength(20)
    expect(store.getState().notice).toContain('20 imported models')
  })
})
