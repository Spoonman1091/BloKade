import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes, setHidden, setMode, updateNode } from '../document/ops'
import type { BloKadeDocument, Transform } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { createRegistry } from '../plugins/registry'
import { definePlugin } from '../plugins/types'
import { Evaluator, NodeBuildError } from './evaluate'
import { initTestOC } from './testing/oc-node'

beforeAll(initTestOC)

const shape = (id: string, shapeType: string, params: Record<string, number>, position: [number, number, number] = [0, 0, 0]) =>
  createShapeNode({ id, shapeType, name: id, params, color: '#fff', position })

function boxWithHole(): BloKadeDocument {
  const doc = [shape('box', 'box', { width: 20, depth: 20, height: 20 }), shape('hole', 'cylinder', { diameter: 10, height: 40 }, [0, 0, -10])]
    .reduce((d, n) => addNode(d, n), createEmptyDocument())
  return groupNodes(setMode(doc, ['hole'], 'hole'), ['box', 'hole'], 'g').doc
}

const newEvaluator = () => new Evaluator(registry, createCadToolkit())

function buildError(fn: () => unknown): NodeBuildError {
  try { fn() } catch (error) { if (error instanceof NodeBuildError) return error }
  throw new Error('expected a NodeBuildError')
}

describe('Evaluator', () => {
  it('builds a shape with its parameters', () => {
    const doc = addNode(createEmptyDocument(), shape('a', 'box', { width: 10, depth: 10, height: 10 }))
    expect(measureVolume(newEvaluator().local(doc, 'a'))).toBeCloseTo(1000, 3)
  })

  it('applies the node transform only when placed', () => {
    const doc = addNode(createEmptyDocument(), shape('a', 'box', { width: 10, depth: 10, height: 10 }, [100, 0, 0]))
    const ev = newEvaluator()
    expect(ev.local(doc, 'a').boundingBox.center[0]).toBeCloseTo(0, 5)
    expect(ev.placed(doc, 'a').boundingBox.center[0]).toBeCloseTo(100, 5)
  })

  it('cuts holes out of solids in a group', () => {
    const volume = measureVolume(newEvaluator().local(boxWithHole(), 'g'))
    expect(volume).toBeCloseTo(8000 - Math.PI * 25 * 20, 1)
  })

  it('ignores hidden parts inside a group', () => {
    const doc = setHidden(boxWithHole(), ['hole'], true)
    expect(measureVolume(newEvaluator().local(doc, 'g'))).toBeCloseTo(8000, 1)
  })

  it('explains a group with only holes', () => {
    const doc = setMode(boxWithHole(), ['box'], 'hole')
    expect(buildError(() => newEvaluator().local(doc, 'g')).message).toContain('no solid parts')
  })

  it('explains holes that cut away everything', () => {
    const doc = updateNode(boxWithHole(), 'hole', (n) => (n.kind === 'shape' ? { ...n, params: { diameter: 100, height: 100 } } : n))
    expect(buildError(() => newEvaluator().local(doc, 'g')).message).toContain('cut away everything')
  })

  it('explains an unknown shape type', () => {
    const doc = addNode(createEmptyDocument(), shape('a', 'spaceship', {}))
    const error = buildError(() => newEvaluator().local(doc, 'a'))
    expect(error.message).toContain('"spaceship"')
    expect(error.nodeId).toBe('a')
  })

  it("names the child when a group's part fails", () => {
    const doc = updateNode(boxWithHole(), 'box', (n) => (n.kind === 'shape' ? { ...n, shapeType: 'spaceship' } : n))
    const error = buildError(() => newEvaluator().local(doc, 'g'))
    expect(error.nodeId).toBe('g')
    expect(error.message).toContain('"box"')
  })

  it('wraps plugin crashes in a friendly message', () => {
    const broken = definePlugin({
      id: 'broken', name: 'Broken', icon: '💥', version: 1, params: {},
      build: () => { throw new Error('kaboom') },
    })
    const { registry: withBroken } = createRegistry([...registry.list(), broken])
    const doc = addNode(createEmptyDocument(), shape('a', 'broken', {}))
    const error = buildError(() => new Evaluator(withBroken, createCadToolkit()).local(doc, 'a'))
    expect(error.message).toBe("Broken couldn't be built: kaboom")
  })

  it('reuses cached shapes and frees unused ones', () => {
    const ev = newEvaluator()
    const doc = boxWithHole()
    ev.beginPass()
    const first = ev.local(doc, 'g')
    ev.endPass()
    ev.beginPass()
    expect(ev.local(doc, 'g')).toBe(first)
    ev.endPass()

    const moved = updateNode(doc, 'hole', (n) => ({ ...n, transform: { position: [5, 0, -10], rotation: [0, 0, 0] } as Transform }))
    ev.beginPass()
    const second = ev.local(moved, 'g')
    ev.endPass()
    expect(second).not.toBe(first)
    expect(() => measureVolume(first)).toThrow()
  })
})
