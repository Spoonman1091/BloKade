import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, updateNode } from '../document/ops'
import type { Modifier, ShapeNode, Vec3 } from '../document/types'
import { registry } from '../plugins/index'
import type { ShapePlugin } from '../plugins/types'
import { createBloKadeStore } from '../store/store'
import { handlesFor } from './face-handles'
import {
  anchorShift, COPIES_HINT, finishSizeDrag, resizesByHandle, sizeDragFrame, sizeHintFor, sizeText, type SizeDragStart,
} from './size-drag'

const BOX: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const CENTRED: Box = { min: [-10, -10, -10], max: [10, 10, 10] }
const FREE = { snap: 0, keepProportions: false }
const ORIGIN: Vec3 = [0, 0, 0]

const boxPlugin = (): ShapePlugin => {
  const found = registry.get('box')
  if (!found) throw new Error('box')
  return found
}
const part = (extra: Partial<Pick<ShapeNode, 'formulas' | 'modifiers'>> & { rotation?: Vec3 } = {}): ShapeNode => ({
  ...createShapeNode({
    shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 }, color: '#ff6b6b', id: 'b',
    rotation: extra.rotation ?? [0, 0, 0],
  }),
  ...(extra.formulas ? { formulas: extra.formulas } : {}),
  ...(extra.modifiers ? { modifiers: extra.modifiers } : {}),
})
const startFor = (node: ShapeNode, id: string, box: Box = BOX): SizeDragStart => {
  const handle = handlesFor(boxPlugin(), box).find((h) => h.id === id)
  if (!handle) throw new Error(id)
  return { node, plugin: boxPlugin(), box, handle, from: ORIGIN }
}
const expectClose = (actual: readonly number[], expected: readonly number[]): void =>
  expected.forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 6))

describe('anchorShift', () => {
  it('moves the part so the far side of a side handle stays put', () => {
    const start = startFor(part(), 'x+')
    expect(anchorShift(BOX, start.handle, [1.5, 1, 1])).toEqual([5, 0, 0])
    expect(anchorShift(BOX, startFor(part(), 'x-').handle, [1.5, 1, 1])).toEqual([-5, 0, 0])
  })

  it('keeps the bottom down when the top handle grows the part', () => {
    expect(anchorShift(BOX, startFor(part(), 'z+').handle, [1, 1, 1.5])).toEqual([0, 0, 0])
  })

  it('keeps the bottom corner and the bottom still when Alt scales a centred part', () => {
    expect(anchorShift(CENTRED, startFor(part(), 'corner-x+y+', CENTRED).handle, [1.5, 1.5, 1.5])).toEqual([5, 5, 5])
  })

  it('grows a linked axis the drag did not touch evenly', () => {
    expect(anchorShift(BOX, startFor(part(), 'x+').handle, [1.5, 1.5, 1])).toEqual([5, 0, 0])
  })
})

describe('sizeDragFrame', () => {
  it('previews the new size and the moved position', () => {
    const frame = sizeDragFrame(startFor(part(), 'x+'), [10, 0, 0], FREE)
    expect(frame).toEqual({ scale: [1.5, 1, 1], position: [5, 0, 0], text: 'Width 30 mm' })
  })

  it('keeps the far side still on a turned part', () => {
    const frame = sizeDragFrame(startFor(part({ rotation: [0, 0, 90] }), 'x+'), [10, 0, 0], FREE)
    expectClose(frame.position, [0, 5, 0])
  })

  it('shows both sizes for a corner', () => {
    expect(sizeDragFrame(startFor(part(), 'corner-x+y+'), [10, 5, 0], FREE).text).toBe('Width 30 mm × Depth 25 mm')
  })

  it('says when a size hit its biggest value', () => {
    expect(sizeText({ scale: [100, 1, 1], changes: [{ key: 'width', label: 'Width', value: 2000 }], biggest: 2000 }))
      .toBe('Biggest size: 2000 mm')
  })
})

describe('finishSizeDrag', () => {
  it('returns nothing when the drag changed nothing', () => {
    const start = startFor(part(), 'x+')
    expect(finishSizeDrag(start, sizeDragFrame(start, ORIGIN, FREE))).toBeNull()
  })

  it('writes the new size and position as one undo step', () => {
    const store = createBloKadeStore({ designId: 'd', doc: addNode(createEmptyDocument(), part()) })
    const start = startFor(part(), 'x+')
    const edited = finishSizeDrag(start, sizeDragFrame(start, [10, 0, 0], FREE))
    if (!edited) throw new Error('nothing changed')
    store.getState().apply((d) => updateNode(d, 'b', () => edited))
    expect(store.getState().history.present.nodes.b).toMatchObject({ params: { width: 30 }, transform: { position: [5, 0, 0] } })
    store.getState().undo()
    expect(store.getState().history.present.nodes.b).toMatchObject({ params: { width: 20 }, transform: { position: [0, 0, 0] } })
  })

  it('drops the formula of the size it changed and keeps the others', () => {
    const withFormulas = part({ formulas: { 'param.width': 'wall * 2', 'param.height': 'tall' } })
    const doc = addNode(createEmptyDocument(), withFormulas)
    const start = startFor(withFormulas, 'x+')
    const edited = finishSizeDrag(start, sizeDragFrame(start, [10, 0, 0], FREE))
    if (!edited) throw new Error('nothing changed')
    expect(updateNode(doc, 'b', () => edited).nodes.b?.formulas).toEqual({ 'param.height': 'tall' })
  })
})

describe('parts with copies or a mirror', () => {
  const pattern: Modifier = { id: 'abcdef12', enabled: true, type: 'linearPattern', count: 3, spacing: [30, 0, 0] }
  const fillet: Modifier = { id: 'abcdef13', enabled: true, type: 'fillet', radius: 1, edges: { by: 'description', which: 'all' } }

  it('get no handles, but rounded edges are fine', () => {
    expect(resizesByHandle(part())).toBe(true)
    expect(resizesByHandle(part({ modifiers: [fillet] }))).toBe(true)
    expect(resizesByHandle(part({ modifiers: [pattern] }))).toBe(false)
    expect(resizesByHandle(part({ modifiers: [{ ...pattern, enabled: false }] }))).toBe(true)
  })

  it('show a hint in Size mode only', () => {
    const doc = addNode(createEmptyDocument(), part({ modifiers: [pattern] }))
    expect(sizeHintFor(doc, ['b'], 'size')).toBe(COPIES_HINT)
    expect(sizeHintFor(doc, ['b'], 'move')).toBeNull()
    expect(sizeHintFor(addNode(createEmptyDocument(), part()), ['b'], 'size')).toBeNull()
    expect(sizeHintFor(doc, [], 'size')).toBeNull()
  })
})
