import { describe, expect, it } from 'vitest'
import { alignNodes } from './align'
import type { Box } from './box'
import { createEmptyDocument, createGroupNode, createShapeNode } from './factory'
import { addNode, DocumentOpError } from './ops'

const at = (id: string, x: number) => createShapeNode({ id, shapeType: 'box', name: id, params: {}, color: '#f00', position: [x, 0, 0] })
const boxAt = (x: number, width: number): Box => ({ min: [x - width / 2, -10, 0], max: [x + width / 2, 10, 20] })

function setup() {
  const doc = [at('a', 0), at('b', 30)].reduce((d, n) => addNode(d, n), createEmptyDocument())
  return { doc, boxes: { a: boxAt(0, 20), b: boxAt(30, 10) } }
}
const x = (doc: ReturnType<typeof setup>['doc'], id: string) => doc.nodes[id]?.transform.position[0]

describe('alignNodes', () => {
  it('lines up left edges', () => {
    const { doc, boxes } = setup()
    const aligned = alignNodes(doc, boxes, ['a', 'b'], 0, 'min')
    expect([x(aligned, 'a'), x(aligned, 'b')]).toEqual([0, -5])
  })

  it('lines up centers and right edges', () => {
    const { doc, boxes } = setup()
    expect(x(alignNodes(doc, boxes, ['a', 'b'], 0, 'center'), 'a')).toBe(12.5)
    expect(x(alignNodes(doc, boxes, ['a', 'b'], 0, 'max'), 'a')).toBe(25)
  })

  it('needs two top-level parts with a shape', () => {
    const { doc, boxes } = setup()
    expect(() => alignNodes(doc, boxes, ['a'], 0, 'min')).toThrow(DocumentOpError)
    expect(() => alignNodes(doc, { a: boxes.a }, ['a', 'b'], 0, 'min')).toThrow('Pick two or more parts')
    const grouped = addNode(createEmptyDocument(), createGroupNode({ id: 'g', children: [] }))
    expect(() => alignNodes(grouped, {}, ['g', 'child'], 0, 'min')).toThrow(DocumentOpError)
  })
})
