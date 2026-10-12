import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { Evaluator } from './evaluate'
import { findOverlap } from './overlap'
import { initTestOC } from './testing/oc-node'

beforeAll(initTestOC)

const cube = (id: string, x: number) =>
  createShapeNode({ id, shapeType: 'box', name: id, params: { width: 20, depth: 20, height: 20 }, color: '#fff', position: [x, 0, 0] })
const twoCubes = (gap: number): BloKadeDocument => [cube('a', 0), cube('b', gap)].reduce((d, n) => addNode(d, n), createEmptyDocument())
const newEvaluator = () => new Evaluator(registry, createCadToolkit())

describe('findOverlap', () => {
  it('measures where two parts overlap and returns its shape', () => {
    const result = findOverlap(newEvaluator(), twoCubes(10), 'a', 'b')
    expect(result.status).toBe('overlap')
    if (result.status !== 'overlap') return
    expect(result.volume).toBeCloseTo(4000, 3)
    expect(result.mesh.positions.length).toBeGreaterThan(0)
  })

  it('says none for parts apart or only touching', () => {
    expect(findOverlap(newEvaluator(), twoCubes(30), 'a', 'b')).toEqual({ status: 'none' })
    expect(findOverlap(newEvaluator(), twoCubes(20), 'a', 'b')).toEqual({ status: 'none' })
  })

  it('checks the whole top-level part when a child is picked', () => {
    const grouped = groupNodes(addNode(twoCubes(10), cube('c', 100)), ['b', 'c'], 'g').doc
    expect(findOverlap(newEvaluator(), grouped, 'a', 'c').status).toBe('overlap')
  })

  it('explains picks that make no sense', () => {
    const grouped = groupNodes(twoCubes(10), ['a', 'b'], 'g').doc
    expect(() => findOverlap(newEvaluator(), grouped, 'a', 'b')).toThrow('Pick two separate parts to check.')
    expect(() => findOverlap(newEvaluator(), twoCubes(10), 'a', 'gone')).toThrow('Pick two separate parts to check.')
  })

  it('names a part that has a problem', () => {
    const broken = addNode(twoCubes(10), createShapeNode({ id: 'x', shapeType: 'nope', name: 'Mystery', params: {}, color: '#fff' }))
    expect(() => findOverlap(newEvaluator(), broken, 'a', 'x')).toThrow('Can\'t check yet: "Mystery" has a problem.')
  })

  it("never frees the evaluator's cached shapes", () => {
    const ev = newEvaluator()
    const doc = twoCubes(10)
    findOverlap(ev, doc, 'a', 'b')
    expect(findOverlap(ev, doc, 'a', 'b').status).toBe('overlap')
  })

  it('says none when measuring an empty intersection throws', async () => {
    vi.resetModules()
    vi.doMock('replicad', async (orig) => ({
      ...(await orig<typeof import('replicad')>()),
      measureVolume: () => { throw new Error('empty shape') },
    }))
    const { findOverlap: mocked } = await import('./overlap')
    expect(mocked(newEvaluator(), twoCubes(10), 'a', 'b')).toEqual({ status: 'none' })
    vi.doUnmock('replicad')
    vi.resetModules()
  })
})
