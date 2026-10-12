import { describe, expect, it, vi, type Mock } from 'vitest'
import type { OverlapResult } from '../geometry/types'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes } from '../document/ops'
import { createBloKadeStore } from '../store/store'
import { visibleOverlapOf } from '../store/overlap'
import { checkOverlap, overlapPair } from './check-overlap'

const box = (id: string) => createShapeNode({ id, shapeType: 'box', name: id, params: {}, color: '#fff' })
const doc = ['a', 'b', 'c'].reduce((d, id) => addNode(d, box(id)), createEmptyDocument())

function setup(overlap: Mock<() => Promise<OverlapResult>> = vi.fn(async (): Promise<OverlapResult> => ({ status: 'none' }))) {
  const store = createBloKadeStore({ designId: 'd', doc })
  return { store, client: { overlap }, overlap }
}

describe('overlapPair', () => {
  it('needs exactly two different top-level parts', () => {
    expect(overlapPair(doc, ['a', 'b'])).toEqual(['a', 'b'])
    expect(overlapPair(doc, ['a'])).toBeNull()
    expect(overlapPair(doc, ['a', 'b', 'c'])).toBeNull()
    const grouped = groupNodes(doc, ['b', 'c'], 'g').doc
    expect(overlapPair(grouped, ['b', 'c'])).toBeNull()
    expect(overlapPair(grouped, ['a', 'c'])).toEqual(['a', 'g'])
  })
})

describe('checkOverlap', () => {
  it('asks for two parts when the selection is wrong (Review Focus 5)', async () => {
    const { store, client, overlap } = setup()
    store.getState().select(['a'])
    await checkOverlap(store, client)
    expect(store.getState().notice).toBe('Select two parts (Shift-click) to check if they overlap.')
    expect(overlap).not.toHaveBeenCalled()
  })

  it('says so when both picks are in the same group', async () => {
    const { store, client, overlap } = setup()
    const grouped = groupNodes(doc, ['b', 'c'], 'g').doc
    const grouping = createBloKadeStore({ designId: 'd', doc: grouped })
    grouping.getState().select(['b', 'c'])
    await checkOverlap(grouping, client)
    expect(grouping.getState().notice).toBe('Those two are in the same group. Pick parts from different groups to check.')
    expect(overlap).not.toHaveBeenCalled()
    expect(store.getState().notice).toBeNull()
  })

  it('stores the result for the checked design and selection', async () => {
    const { store, client } = setup(vi.fn(async () => ({ status: 'overlap' as const, volume: 12.34, mesh: {} as never })))
    store.getState().select(['a', 'b'])
    await checkOverlap(store, client)
    expect(visibleOverlapOf(store.getState())).toMatchObject({ status: 'overlap', volume: 12.34 })
  })

  it('drops a result that arrives after the design changed (Review Focus 5)', async () => {
    let finish: (value: OverlapResult) => void = () => undefined
    const { store, client } = setup(vi.fn(() => new Promise<OverlapResult>((resolve) => { finish = resolve })))
    store.getState().select(['a', 'b'])
    const running = checkOverlap(store, client)
    store.getState().apply((d) => ({ ...d, name: 'Changed' }))
    finish({ status: 'none' })
    await running
    expect(store.getState().overlap).toBeNull()
  })

  it('shows the engine\'s explanation when a part has a problem', async () => {
    const { store, client } = setup(vi.fn(async () => { throw new Error('Can\'t check yet: "b" has a problem.') }))
    store.getState().select(['a', 'b'])
    await checkOverlap(store, client)
    expect(store.getState().notice).toBe('Can\'t check yet: "b" has a problem.')
  })
})
