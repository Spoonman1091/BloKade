import { Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'
import { boxMesh } from '../app/testing/meshes'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { transformToMatrix } from '../document/transform-math'
import { meshBox, topLevelBoxes } from './bounds'

const close = (v: readonly number[]) => v.map((n) => Math.round(n * 1000) / 1000 + 0)

describe('bounds', () => {
  it('places a mesh box with the part transform', () => {
    const box = meshBox(boxMesh(20, 10, 4).positions, transformToMatrix({ position: [5, 0, 1], rotation: [0, 0, 90] }))
    expect(close(box?.min ?? [])).toEqual([0, -10, 1])
    expect(close(box?.max ?? [])).toEqual([10, 10, 5])
  })

  it('has no box for an empty mesh', () => {
    expect(meshBox(new Float32Array(0), new Matrix4())).toBeNull()
  })

  it('collects boxes for visible top-level parts that have a mesh', () => {
    const shape = (id: string, x: number, hidden = false) =>
      ({ ...createShapeNode({ id, shapeType: 'box', name: id.toUpperCase(), params: {}, color: '#f00', position: [x, 0, 0] }), hidden })
    const doc = [shape('a', 0), shape('b', 30), shape('h', 60, true), shape('m', 90)].reduce((d, n) => addNode(d, n), createEmptyDocument())
    const mesh = { mesh: boxMesh(20, 20, 20), stale: false }
    const boxes = topLevelBoxes(doc, { a: mesh, b: mesh, h: mesh })
    expect(boxes.map((b) => [b.id, b.name, b.box.min[0]])).toEqual([['a', 'A', -10], ['b', 'B', 20]])
  })
})
