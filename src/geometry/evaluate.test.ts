import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes, setHidden, setMode, updateNode } from '../document/ops'
import { modifierField, writeField } from '../document/fields'
import { addModifier, setEdgeSelection } from '../document/modifiers'
import type { BloKadeDocument, Transform } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { createRegistry } from '../plugins/registry'
import { definePlugin, type ShapePlugin } from '../plugins/types'
import type { KadeBuild } from '../kade/run-build'
import { Evaluator, NodeBuildError } from './evaluate'
import { shapeBox } from './edge-info'
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

  it('keeps group members cached across passes', () => {
    const ev = newEvaluator()
    const doc = boxWithHole()
    const moved = updateNode(doc, 'hole', (n) => ({ ...n, transform: { position: [5, 0, -10], rotation: [0, 0, 0] } as Transform }))
    const run = (d: BloKadeDocument) => {
      ev.beginPass()
      ev.local(d, 'g')
      const box = ev.placed(d, 'box')
      ev.endPass()
      return box
    }
    const first = run(doc)
    expect(run(doc)).toBe(first)
    expect(run(moved)).toBe(first)
    expect(measureVolume(first)).toBeCloseTo(8000, 1)
  })

  it('recovers after a group build fails midway', () => {
    const base = boxWithHole()
    const extra = addNode(base, shape('box2', 'box', { width: 5, depth: 5, height: 5 }))
    const bad = updateNode(
      { ...extra, nodes: { ...extra.nodes, g: { ...(extra.nodes.g as object), children: ['box', 'box2', 'hole'] } as never } },
      'box2', (n) => (n.kind === 'shape' ? { ...n, shapeType: 'spaceship' } : n),
    )
    const ev = newEvaluator()
    expect(buildError(() => ev.local(bad, 'g')).nodeId).toBe('g')
    const good = updateNode(bad, 'box2', (n) => (n.kind === 'shape' ? { ...n, shapeType: 'box' } : n))
    expect(measureVolume(ev.local(good, 'g'))).toBeGreaterThan(0)
    const badHole = updateNode(base, 'hole', (n) => (n.kind === 'shape' ? { ...n, shapeType: 'spaceship' } : n))
    expect(buildError(() => ev.local(badHole, 'g')).nodeId).toBe('g')
    expect(measureVolume(ev.local(base, 'g'))).toBeCloseTo(8000 - Math.PI * 25 * 20, 1)
  })
})

describe('Evaluator modifiers', () => {
  const withModifier = (doc: BloKadeDocument, id: string, type: 'fillet' | 'linearPattern' | 'mirror') => addModifier(doc, id, type)

  it('applies modifiers to a part before placing it', () => {
    const base = addNode(createEmptyDocument(), shape('a', 'box', { width: 20, depth: 20, height: 20 }, [100, 0, 0]))
    const { doc } = withModifier(base, 'a', 'fillet')
    const ev = newEvaluator()
    expect(measureVolume(ev.local(doc, 'a'))).toBeLessThan(8000)
    const box = shapeBox(ev.placed(doc, 'a'))
    expect((box.min[0] + box.max[0]) / 2).toBeCloseTo(100, 3)
  })

  it('rounds the combined shape of a group (Review Focus 4)', () => {
    const { doc } = withModifier(boxWithHole(), 'g', 'fillet')
    const plain = 8000 - Math.PI * 25 * 20
    expect(measureVolume(newEvaluator().local(doc, 'g'))).toBeLessThan(plain)
  })

  it('a row of holes inside a group cuts every hole (Review Focus 4)', () => {
    const parts = [shape('box', 'box', { width: 100, depth: 20, height: 20 }), shape('hole', 'cylinder', { diameter: 6, height: 40 }, [-30, 0, -10])]
    const grouped = groupNodes(setMode(parts.reduce((d, n) => addNode(d, n), createEmptyDocument()), ['hole'], 'hole'), ['box', 'hole'], 'g').doc
    const { doc, modifierId } = withModifier(grouped, 'hole', 'linearPattern')
    const spaced = updateNode(doc, 'hole', (n) => writeField(n, modifierField(modifierId, 'spacing', 0), 30))
    expect(measureVolume(newEvaluator().local(spaced, 'g'))).toBeCloseTo(40000 - 3 * Math.PI * 9 * 20, 0)
  })

  it('turns a modifier problem into a build error for that part only (Review Focus 1)', () => {
    const base = [shape('a', 'box', { width: 20, depth: 20, height: 20 }), shape('b', 'box', { width: 10, depth: 10, height: 10 }, [50, 0, 0])]
      .reduce((d, n) => addNode(d, n), createEmptyDocument())
    const { doc, modifierId } = withModifier(base, 'a', 'fillet')
    const tooBig = updateNode(doc, 'a', (n) => writeField(n, modifierField(modifierId, 'radius'), 15))
    const ev = newEvaluator()
    expect(buildError(() => ev.local(tooBig, 'a')).message).toContain('too big for these edges')
    expect(measureVolume(ev.local(tooBig, 'b'))).toBeCloseTo(1000, 3)
  })

  it('reports modifier warnings for the parts built in this pass', () => {
    const base = addNode(createEmptyDocument(), shape('s', 'sphere', { diameter: 20 }))
    const { doc, modifierId } = withModifier(base, 's', 'fillet')
    const ev = newEvaluator()
    ev.beginPass()
    ev.local(doc, 's')
    ev.endPass()
    expect(ev.warnings()).toEqual({ s: { [modifierId]: 'No edges match, so this does nothing yet.' } })
    ev.beginPass()
    ev.local(doc, 's')
    expect(ev.warnings()).toEqual({ s: { [modifierId]: 'No edges match, so this does nothing yet.' } })
  })

  it('reuses the cached result until a modifier changes', () => {
    const { doc, modifierId } = withModifier(addNode(createEmptyDocument(), shape('a', 'box', { width: 20, depth: 20, height: 20 })), 'a', 'fillet')
    const ev = newEvaluator()
    const first = ev.local(doc, 'a')
    expect(ev.local(doc, 'a')).toBe(first)
    const changed = setEdgeSelection(doc, 'a', modifierId, { by: 'description', which: 'bottom' })
    expect(ev.local(changed, 'a')).not.toBe(first)
  })

  it('lists the edges a Round edges modifier can pick, marking the chosen ones', () => {
    const { doc, modifierId } = withModifier(addNode(createEmptyDocument(), shape('a', 'box', { width: 20, depth: 20, height: 20 })), 'a', 'fillet')
    const candidates = newEvaluator().edgeCandidates(doc, 'a', modifierId)
    expect(candidates).toHaveLength(12)
    expect(candidates.filter((c) => c.picked)).toHaveLength(4)
    expect(candidates[0]?.points).toHaveLength(6)
    expect(candidates.find((c) => c.picked)?.fingerprint.mid[2]).toBe(1)
  })

  it("doesn't offer a cylinder's seam line as an edge to pick", () => {
    const { doc, modifierId } = withModifier(addNode(createEmptyDocument(), shape('c', 'cylinder', { diameter: 20, height: 20 })), 'c', 'fillet')
    const candidates = newEvaluator().edgeCandidates(doc, 'c', modifierId)
    expect(candidates.map((c) => c.fingerprint.kind)).toEqual(['circle', 'circle'])
  })

  it('refuses edge picking for modifiers that have no edges', () => {
    const { doc, modifierId } = withModifier(addNode(createEmptyDocument(), shape('a', 'box', { width: 20, depth: 20, height: 20 })), 'a', 'mirror')
    expect(buildError(() => newEvaluator().edgeCandidates(doc, 'a', modifierId)).message).toContain('Only Round edges and Bevel edges')
  })

  it('reuses the shape before the picked modifier while Kade clicks edges', () => {
    const base = addNode(createEmptyDocument(), shape('a', 'box', { width: 20, depth: 20, height: 20 }))
    const repeated = withModifier(base, 'a', 'linearPattern').doc
    const { doc, modifierId } = withModifier(repeated, 'a', 'fillet')
    const ev = newEvaluator()
    const fuseOwner = fuseOwnerOf(createCadToolkit().box(1, 1, 1))
    const fuse = vi.spyOn(fuseOwner, 'fuse')
    try {
      const first = ev.edgeCandidates(doc, 'a', modifierId)
      const picked = setEdgeSelection(doc, 'a', modifierId, { by: 'picked', fingerprints: [first[0]!.fingerprint] })
      ev.beginPass()
      ev.local(picked, 'a')
      ev.endPass()
      fuse.mockClear()
      expect(ev.edgeCandidates(picked, 'a', modifierId).filter((c) => c.picked)).toHaveLength(1)
      expect(fuse).not.toHaveBeenCalled()
    } finally {
      fuse.mockRestore()
    }
  })
})

/** The replicad prototype that defines fuse(), so a test can count fuses. Frees `sample`. */
function fuseOwnerOf(sample: Shape3D): { fuse: Shape3D['fuse'] } {
  let proto: object | null = Object.getPrototypeOf(sample) as object
  while (proto && !Object.hasOwn(proto, 'fuse')) proto = Object.getPrototypeOf(proto) as object | null
  sample.delete()
  if (!proto) throw new Error('fuse not found')
  return proto as { fuse: Shape3D['fuse'] }
}

describe("Evaluator with Kade's shapes", () => {
  const kadePlugin = (revision: string, build: KadeBuild): ShapePlugin => ({
    id: 'kade-thing', name: 'Kade thing', icon: '🧩', version: 1, revision, toolkit: 'kade',
    params: { w: { type: 'mm', default: 10, label: 'W' } },
    // Kade's builds take the friendly toolkit; the evaluator calls them through runKadeBuild.
    build: build as unknown as ShapePlugin['build'],
  })
  const registryOf = (plugin: ShapePlugin) => createRegistry([plugin]).registry
  const doc = () => addNode(createEmptyDocument(), createShapeNode({ id: 'k', shapeType: 'kade-thing', name: 'K', params: { w: 10 }, color: '#fff' }))

  it('builds them with the friendly toolkit', () => {
    const evaluator = new Evaluator(registryOf(kadePlugin('r1', (v, cad) => cad.box(v.w, 10, 10).move(0, 0, 5))), createCadToolkit())
    expect(evaluator.local(doc(), 'k').boundingBox.bounds[0]?.[2]).toBeCloseTo(5)
  })
  it('puts the friendly message on the part', () => {
    const evaluator = new Evaluator(registryOf(kadePlugin('r1', () => undefined)), createCadToolkit())
    expect(buildError(() => evaluator.local(doc(), 'k')).message)
      .toBe("Kade thing couldn't be built: build() needs to end with return and a part, like return cad.box(10, 10, 10).")
  })
  it('rebuilds when the code changes, even with the same id and settings', () => {
    const evaluator = new Evaluator(registryOf(kadePlugin('r1', (_v, cad) => cad.box(10, 10, 10))), createCadToolkit())
    const first = evaluator.local(doc(), 'k')
    evaluator.setRegistry(registryOf(kadePlugin('r2', (_v, cad) => cad.box(20, 10, 10))))
    const second = evaluator.local(doc(), 'k')
    expect(second).not.toBe(first)
    expect(second.boundingBox.bounds[1]?.[0]).toBeCloseTo(10)
  })
})
