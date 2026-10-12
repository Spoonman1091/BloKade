import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from './factory'
import {
  addNode, DocumentOpError, DUPLICATE_OFFSET, duplicateNodes, groupNodes, moveNode, removeNodes,
  renameDocument, renameNode, setGridSnap, setHidden, setMode, ungroupNode, updateNode,
} from './ops'
import { worldMatrix } from './transform-math'
import type { BloKadeDocument, Transform } from './types'

const box = (id: string, position: [number, number, number] = [0, 0, 0]) =>
  createShapeNode({ id, shapeType: 'box', name: `Box ${id}`, params: { width: 10 }, color: '#fff', position })

/** root: [a, b, c] */
function threeBoxes(): BloKadeDocument {
  return [box('a'), box('b', [20, 0, 0]), box('c')].reduce((d, n) => addNode(d, n), createEmptyDocument())
}

const worldPos = (doc: BloKadeDocument, id: string) =>
  new Vector3().applyMatrix4(worldMatrix(doc, id)).toArray().map((v) => Math.round(v * 1e6) / 1e6)

describe('addNode / updateNode', () => {
  it('adds at top level without touching the original', () => {
    const empty = createEmptyDocument()
    const doc = addNode(empty, box('a'))
    expect(doc.root).toEqual(['a'])
    expect(empty.root).toEqual([])
  })

  it('refuses duplicate ids', () => {
    expect(() => addNode(threeBoxes(), box('a'))).toThrow(DocumentOpError)
  })

  it('updates a node immutably', () => {
    const doc = threeBoxes()
    const next = updateNode(doc, 'a', (n) => ({ ...n, name: 'Base' }))
    expect(next.nodes.a?.name).toBe('Base')
    expect(doc.nodes.a?.name).toBe('Box a')
  })

  it('refuses to change id or kind', () => {
    expect(() => updateNode(threeBoxes(), 'a', (n) => ({ ...n, id: 'zzz' }))).toThrow(DocumentOpError)
  })

  it('reports missing parts in plain English', () => {
    expect(() => updateNode(threeBoxes(), 'ghost', (n) => n)).toThrow('That part no longer exists.')
  })
})

describe('removeNodes', () => {
  it('removes nodes and their descendants', () => {
    const { doc, groupId } = groupNodes(threeBoxes(), ['a', 'b'])
    const next = removeNodes(doc, [groupId])
    expect(next.root).toEqual(['c'])
    expect(Object.keys(next.nodes)).toEqual(['c'])
  })

  it('removes a child from its group', () => {
    const { doc, groupId } = groupNodes(threeBoxes(), ['a', 'b'])
    const next = removeNodes(doc, ['a'])
    const group = next.nodes[groupId]
    expect(group?.kind === 'group' && group.children).toEqual(['b'])
  })
})

describe('groupNodes / ungroupNode', () => {
  it('groups siblings in place, keeping their order', () => {
    const { doc, groupId } = groupNodes(threeBoxes(), ['c', 'b'], 'g')
    expect(groupId).toBe('g')
    expect(doc.root).toEqual(['a', 'g'])
    const group = doc.nodes.g
    expect(group?.kind === 'group' && group.children).toEqual(['b', 'c'])
  })

  it('needs at least two parts at the same level', () => {
    expect(() => groupNodes(threeBoxes(), ['a'])).toThrow('Pick at least two parts to group.')
    const { doc } = groupNodes(threeBoxes(), ['a', 'b'], 'g')
    expect(() => groupNodes(doc, ['a', 'c'])).toThrow('same level')
  })

  it('ungroups back into the parent, keeping world placement', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    const moved = updateNode(grouped, 'g', (n) => ({ ...n, transform: { position: [0, 10, 0], rotation: [0, 0, 90] } as Transform }))
    const before = worldPos(moved, 'b')
    const { doc, childIds } = ungroupNode(moved, 'g')
    expect(childIds).toEqual(['a', 'b'])
    expect(doc.root).toEqual(['a', 'b', 'c'])
    expect(doc.nodes.g).toBeUndefined()
    expect(worldPos(doc, 'b')).toEqual(before)
  })

  it('refuses to ungroup a shape', () => {
    expect(() => ungroupNode(threeBoxes(), 'a')).toThrow("That's not a group.")
  })
})

describe('moveNode', () => {
  it('moves into a group and keeps world placement', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    const shifted = updateNode(grouped, 'g', (n) => ({ ...n, transform: { position: [7, 0, 0], rotation: [0, 0, 0] } as Transform }))
    const before = worldPos(shifted, 'c')
    const doc = moveNode(shifted, 'c', 'g')
    expect(doc.root).toEqual(['g'])
    expect(worldPos(doc, 'c')).toEqual(before)
    expect(doc.nodes.c?.transform.position).toEqual([-7, 0, 0])
  })

  it('moves back to the top level', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    expect(moveNode(grouped, 'a', null).root).toEqual(['g', 'c', 'a'])
  })

  it("refuses to put a group inside itself", () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    expect(() => moveNode(grouped, 'g', 'g')).toThrow("can't go inside itself")
  })
})

describe('duplicateNodes', () => {
  it('copies a group with fresh ids, offset, right after the original', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    const { doc, newIds } = duplicateNodes(grouped, ['g'])
    const [copyId] = newIds
    expect(copyId).toBeDefined()
    expect(doc.root).toEqual(['g', copyId, 'c'])
    const copy = doc.nodes[copyId as string]
    expect(copy?.kind).toBe('group')
    expect(copy?.transform.position).toEqual(DUPLICATE_OFFSET)
    const children = copy?.kind === 'group' ? copy.children : []
    expect(children).toHaveLength(2)
    expect(children).not.toContain('a')
    expect(Object.keys(doc.nodes)).toHaveLength(Object.keys(grouped.nodes).length + 3)
  })

  it('skips parts whose group is also being duplicated', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    expect(duplicateNodes(grouped, ['g', 'a']).newIds).toHaveLength(1)
  })
})

describe('simple setters', () => {
  it('sets mode and visibility', () => {
    const doc = setHidden(setMode(threeBoxes(), ['a', 'b'], 'hole'), ['c'], true)
    expect(doc.nodes.a?.mode).toBe('hole')
    expect(doc.nodes.b?.mode).toBe('hole')
    expect(doc.nodes.c?.hidden).toBe(true)
  })

  it('renames with trimming and refuses empty names', () => {
    expect(renameNode(threeBoxes(), 'a', '  Base  ').nodes.a?.name).toBe('Base')
    expect(() => renameNode(threeBoxes(), 'a', '   ')).toThrow("Names can't be empty.")
  })

  it('renames the whole design', () => {
    expect(renameDocument(threeBoxes(), ' Phone Stand ').name).toBe('Phone Stand')
    expect(() => renameDocument(threeBoxes(), '')).toThrow("Names can't be empty.")
  })

  it('sets grid snap and refuses negatives', () => {
    expect(setGridSnap(threeBoxes(), 0.5).settings.gridSnap).toBe(0.5)
    expect(() => setGridSnap(threeBoxes(), -1)).toThrow(DocumentOpError)
  })
})

describe('prototype-named ids', () => {
  it('reports prototype names as missing parts instead of returning prototype members', () => {
    expect(() => updateNode(threeBoxes(), 'constructor', (n) => n)).toThrow('That part no longer exists.')
    expect(() => moveNode(threeBoxes(), 'toString', null)).toThrow('That part no longer exists.')
  })
})

describe('move target validation', () => {
  it('reports a missing target as a missing part', () => {
    expect(() => moveNode(threeBoxes(), 'a', 'ghost')).toThrow(DocumentOpError)
    expect(() => moveNode(threeBoxes(), 'a', 'ghost')).toThrow('That part no longer exists.')
  })

  it('refuses to move into a shape', () => {
    expect(() => moveNode(threeBoxes(), 'a', 'b')).toThrow('Only groups can hold other parts.')
  })
})

describe('group id validation', () => {
  it('refuses a group id that already exists', () => {
    expect(() => groupNodes(threeBoxes(), ['a', 'b'], 'c')).toThrow(DocumentOpError)
    expect(() => groupNodes(threeBoxes(), ['a', 'b'], 'c')).toThrow('already exists')
  })

  it('treats repeated ids as one part', () => {
    expect(() => groupNodes(threeBoxes(), ['a', 'a'])).toThrow('Pick at least two parts to group.')
  })
})
