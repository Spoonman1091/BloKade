import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createGroupNode, createShapeNode } from './factory'
import { matrixToTransform, transformFromParts, transformToMatrix, worldMatrix } from './transform-math'
import type { BloKadeDocument, Transform } from './types'

describe('transform math', () => {
  it('round-trips a transform through a matrix', () => {
    const t: Transform = { position: [1.5, -2, 3], rotation: [30, 45, 60] }
    expect(matrixToTransform(transformToMatrix(t))).toEqual(t)
  })

  it('never produces negative zero', () => {
    const t = matrixToTransform(transformToMatrix({ position: [-0, 0, 0], rotation: [0, 0, 0] }))
    expect(Object.is(t.position[0], -0)).toBe(false)
  })

  it('builds transforms from radians', () => {
    expect(transformFromParts([1, 2, 3], [Math.PI / 2, 0, Math.PI])).toEqual({ position: [1, 2, 3], rotation: [90, 0, 180] })
  })

  it('composes parent and child transforms', () => {
    const child = { ...createShapeNode({ id: 'c', shapeType: 'box', name: 'c', params: {}, color: '#fff' }),
      transform: { position: [5, 0, 0], rotation: [0, 0, 0] } as Transform }
    const group = { ...createGroupNode({ id: 'g', children: ['c'] }),
      transform: { position: [10, 0, 0], rotation: [0, 0, 90] } as Transform }
    const doc: BloKadeDocument = { ...createEmptyDocument(), root: ['g'], nodes: { c: child, g: group } }
    const p = new Vector3().applyMatrix4(worldMatrix(doc, 'c'))
    expect(p.x).toBeCloseTo(10)
    expect(p.y).toBeCloseTo(5)
    expect(p.z).toBeCloseTo(0)
  })
})
